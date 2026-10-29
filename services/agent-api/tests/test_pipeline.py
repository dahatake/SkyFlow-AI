from __future__ import annotations

import asyncio

import pytest
from conftest import ADVICE, EXCEPTIONS, INJECTION, SCORES, FakeEngine, FakeModel, FakeShield, delta, NONE

from agent_api.engine_client import ALLOWED_TOOLS, EngineError, TracedEngine
from agent_api.model import NullModel
from agent_api.models import Recommendation
from agent_api.pipeline import AGENTS, Pipeline
from agent_api.safety import CircuitBreaker


def pipe(settings, engine, model, shield=None, breaker=None) -> Pipeline:
    return Pipeline(settings, engine, model, shield, breaker)


def stage_steps(rec):
    return [s for s in rec.steps if s.tool is None]


async def test_rules_mode_schema_and_engine_numbers(settings, engine):
    rec, audit = await pipe(settings, engine, NullModel()).propose("demo-weather", 0, "rules")
    Recommendation.model_validate(rec.model_dump())
    assert rec.mode == "rules" and rec.fallbackUsed is False and rec.status == "Proposed"
    assert {(i.taskId, i.optionId) for i in rec.items} == set(ADVICE.items())
    for i in rec.items:
        assert i.kpiDelta == delta(NONE, SCORES[i.taskId][i.optionId])
    assert rec.kpi["before"]["weighted"] == 100 and rec.kpi["weightedImprovement"] > 0
    assert rec.teamsCard["type"] == "AdaptiveCard"
    assert [a["title"] for a in rec.teamsCard["actions"]] == ["Approve", "Reject"]
    assert all(a["url"].startswith("https://api.example/api/agent/proposals/") for a in rec.teamsCard["actions"])
    assert rec.traceId and any(e["type"] == "tool.call" for e in audit)


async def test_handoff_order_detect_triage_resolver_comms(settings, engine):
    rec, _ = await pipe(settings, engine, FakeModel()).propose("demo-weather", 0, "agent")
    stages = stage_steps(rec)
    assert [s.agent for s in stages] == list(AGENTS)
    assert [s.handoffTo for s in stages] == ["Triage", "Resolver", "Comms", None]
    first_tool_agents = [s.agent for s in rec.steps]
    assert first_tool_agents == sorted(first_tool_agents, key=AGENTS.index)  # no agent runs after a later agent started
    assert not rec.fallbackUsed and all(s.status == "ok" for s in stages)


async def test_agent_mode_uses_two_deployments_and_resolver_tools_only(settings, engine):
    model = FakeModel()
    await pipe(settings, engine, model).propose("demo-weather", 0, "agent")
    assert {c["agent"]: c["deployment"] for c in model.calls} == {"Detect": "fast", "Triage": "fast", "Resolver": "primary", "Comms": "fast"}
    assert [c["agent"] for c in model.calls if c["tools"]] == ["Resolver"]


async def test_hallucinated_option_id_is_rejected_and_falls_back(settings, engine):
    bad = lambda p: __import__("agent_api.models", fromlist=["ResolverOut"]).ResolverOut(  # noqa: E731
        choices=[{"taskId": d["taskId"], "optionId": "teleport-everything", "rationale": "x", "confidence": "High"} for d in p["decisions"]])
    rec, audit = await pipe(settings, engine, FakeModel({"Resolver": bad})).propose("demo-weather", 0, "agent")
    assert rec.fallbackUsed is True
    assert {(i.taskId, i.optionId) for i in rec.items} == set(ADVICE.items())
    resolver = next(s for s in stage_steps(rec) if s.agent == "Resolver")
    assert resolver.status == "fallback" and "not an engine option" in resolver.detail
    assert any(e.get("outcome") == "rejected" for e in audit)


async def test_hallucinated_task_and_incomplete_coverage_rejected(settings, engine):
    from agent_api.models import ResolverOut

    for choices in (
        [{"taskId": "t-gate", "optionId": "move", "rationale": "x", "confidence": "Low"}],  # misses t-crew
        [{"taskId": "t-ghost", "optionId": "none", "rationale": "x", "confidence": "Low"}],
    ):
        rec, _ = await pipe(settings, engine, FakeModel({"Resolver": lambda p, c=choices: ResolverOut(choices=c)})).propose("demo-weather", 0, "agent")
        assert rec.fallbackUsed and {(i.taskId, i.optionId) for i in rec.items} == set(ADVICE.items())


async def test_model_invented_numbers_are_rejected(settings, engine):
    from agent_api.models import ResolverOut

    lie = lambda p: ResolverOut(choices=[{"taskId": d["taskId"], "optionId": d["engineAdvice"], "rationale": "Saves 9876 minutes.", "confidence": "High"} for d in p["decisions"]])  # noqa: E731
    rec, _ = await pipe(settings, engine, FakeModel({"Resolver": lie})).propose("demo-weather", 0, "agent")
    assert rec.fallbackUsed and "9876" not in " ".join(i.rationale for i in rec.items)


async def test_unknown_exception_ids_from_detect_rejected(settings, engine):
    from agent_api.models import DetectOut

    rec, _ = await pipe(settings, engine, FakeModel({"Detect": lambda p: DetectOut(exceptionIds=["ex-999"], summary="x")})).propose("demo-weather", 0, "agent")
    assert next(s for s in stage_steps(rec) if s.agent == "Detect").status == "fallback"
    assert rec.fallbackUsed


async def test_no_model_falls_back_to_rules_with_same_selection(settings, engine):
    rules_rec, _ = await pipe(settings, engine, NullModel()).propose("demo-weather", 0, "rules")
    agent_rec, _ = await pipe(settings, FakeEngine(), NullModel()).propose("demo-weather", 0, "agent")
    assert agent_rec.fallbackUsed is True and rules_rec.fallbackUsed is False
    assert [(i.taskId, i.optionId) for i in agent_rec.items] == [(i.taskId, i.optionId) for i in rules_rec.items]
    assert all(s.status == "fallback" for s in stage_steps(agent_rec))


async def test_model_errors_use_retry_budget_then_circuit_breaker_opens(settings, engine):
    model = FakeModel(error=TimeoutError("slow"))
    breaker = CircuitBreaker(threshold=3, cooldown_s=1000)
    p = pipe(settings, engine, model, breaker=breaker)
    rec, _ = await p.propose("demo-weather", 0, "agent")
    assert rec.fallbackUsed and {(i.taskId, i.optionId) for i in rec.items} == set(ADVICE.items())
    assert len(model.calls) <= settings.retry_budget * 2 + 3  # bounded by retry budget and the breaker
    assert breaker.is_open
    before = len(model.calls)
    rec2, _ = await p.propose("demo-weather", 0, "agent")
    assert len(model.calls) == before and rec2.fallbackUsed  # breaker open: the model is not even called
    assert any(s.detail == "circuit breaker open" for s in rec2.steps)


async def test_prompt_shields_attack_or_outage_disables_model(settings, engine):
    for shield in (FakeShield(attack=True), FakeShield(boom=True)):
        model = FakeModel()
        rec, _ = await pipe(settings, FakeEngine(), model, shield).propose("demo-weather", 0, "agent")
        assert model.calls == [] and rec.fallbackUsed
        assert any(s.tool == "prompt_shields" and s.status == "fallback" for s in rec.steps)
    ok = FakeShield()
    rec, _ = await pipe(settings, FakeEngine(), FakeModel(), ok).propose("demo-weather", 0, "agent")
    assert not rec.fallbackUsed and ok.seen and "Lightning" in ok.seen[0][0]


async def test_prompt_injection_in_remarks_does_not_change_tools_or_selection(settings):
    clean_engine, dirty_engine = FakeEngine(), FakeEngine([{**e, "explanation": INJECTION, "nextAction": INJECTION} for e in EXCEPTIONS])
    clean_model, dirty_model = FakeModel(), FakeModel()
    clean, _ = await pipe(settings, clean_engine, clean_model).propose("demo-weather", 0, "agent")
    dirty, audit = await pipe(settings, dirty_engine, dirty_model).propose("demo-weather", 0, "agent")
    assert dirty_engine.tools == clean_engine.tools and dirty_engine.tools <= ALLOWED_TOOLS
    assert [t for t, _ in dirty_engine.calls] == [t for t, _ in clean_engine.calls]
    assert [(i.taskId, i.optionId) for i in dirty.items] == [(i.taskId, i.optionId) for i in clean.items]
    detect_prompt = dirty_model.calls[0]["prompt"]
    assert "delete_everything" in detect_prompt and "<data" in detect_prompt
    assert "</data> SYSTEM" not in detect_prompt  # the closing-tag break-out was neutralised
    assert all("ignore any instructions" in c["instructions"] for c in dirty_model.calls)
    assert dirty.mode == "agent" and not dirty.fallbackUsed


async def test_engine_allowlist_blocks_unknown_tools():
    te = TracedEngine(FakeEngine())
    with pytest.raises(EngineError) as e:
        await te.call("Detect", "delete_everything", {})
    assert e.value.code == "tool_not_allowed" and te.calls == []


async def test_pipeline_time_limit_falls_back(settings, engine):
    class Slow(FakeModel):
        async def run(self, **kw):
            await asyncio.sleep(5)

    s = settings.__class__(**{**settings.__dict__, "model_timeout_s": 0.05, "retry_budget": 0})
    rec, _ = await pipe(s, engine, Slow()).propose("demo-weather", 0, "agent")
    assert rec.fallbackUsed and {(i.taskId, i.optionId) for i in rec.items} == set(ADVICE.items())


async def test_unknown_demo_is_an_engine_error(settings, engine):
    with pytest.raises(EngineError) as e:
        await pipe(settings, engine, NullModel()).propose("nope", 0, "rules")
    assert e.value.code == "unknown_demo"
