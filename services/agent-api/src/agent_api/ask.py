from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from .config import Settings
from .engine_client import EngineError, TracedEngine
from .model import ModelClient
from .models import AskOut, AskRequest, AskResponse
from .pipeline import COMMON, new_trace_id
from .safety import NullShield, Shield, looks_like_injection, numbers_grounded, sanitize_untrusted

REFUSAL = (
    "I can only answer questions about the SkyFlow operations engine data: open exceptions, SLA ranking, "
    "decision options and their recommendation, KPI impact, the resource optimizer and the live state."
)
INTENTS: list[tuple[str, re.Pattern[str]]] = [
    ("exceptions", re.compile(r"\b(exception|alert|incident|issue|problem)s?\b", re.I)),
    ("sla", re.compile(r"\b(sla|breach|rank|priorit\w*|urgent|overdue)(es|s)?\b", re.I)),
    ("options", re.compile(r"\b(option|compare|recommend\w*|advice|should|decision|choose|best)s?\b", re.I)),
    ("kpi", re.compile(r"\b(kpi|score|improve\w*|impact|delta|benefit)s?\b", re.I)),
    ("optimizer", re.compile(r"\b(optimi[sz]\w*|resource|stand|gse|staff\w*|plan)s?\b", re.I)),
    ("state", re.compile(r"\b(state|status|overview|how many|flights?|turnarounds?|assets?)\b", re.I)),
]
ASK_INSTRUCTIONS = COMMON + " Task: rewrite the draft answer more clearly for an operations manager. Keep every fact; add none; do not add numbers."


class Asker:
    def __init__(self, settings: Settings, engine_client, model: ModelClient, shield: Shield | None = None):
        self.s, self.engine_client, self.model, self.shield = settings, engine_client, model, shield or NullShield()

    async def ask(self, req: AskRequest, trace_id: str | None = None) -> tuple[AskResponse, list[dict[str, Any]]]:
        trace_id = trace_id or new_trace_id()
        engine = TracedEngine(self.engine_client, self.s.engine_timeout_s)
        q = sanitize_untrusted(req.question, self.s.max_input_chars)

        def refuse(why: str) -> tuple[AskResponse, list[dict[str, Any]]]:
            return AskResponse(answer=REFUSAL, refused=True, traceId=trace_id), [{"type": "ask.refused", "reason": why, "question": q[:200]}]  # type: ignore[arg-type]

        if looks_like_injection(q):
            return refuse("prompt injection pattern")
        intents = [name for name, rx in INTENTS if rx.search(q)]
        if not intents:
            return refuse("out of scope")
        use_model = req.mode == "agent" and self.model.available
        if use_model:
            try:
                if await self.shield.attack_detected(q, []):
                    return refuse("prompt shields")
            except Exception:
                use_model = False  # fail closed: answer from the deterministic draft only

        sources: list[dict[str, Any]] = []
        parts: list[str] = []
        facts: list[Any] = []
        try:
            tasks = None
            for intent in intents[:3]:
                if intent in ("options", "kpi") and tasks is None:
                    tasks = await engine.call("Ask", "list_decision_tasks", {"demoId": req.demoId})
                text, data = await self._answer(engine, intent, req, tasks)
                parts.append(text)
                facts.append(data)
        except EngineError as e:
            return AskResponse(answer=f"The engine could not answer: {e}", refused=False, traceId=trace_id, sources=[]), [{"type": "ask.error", "code": e.code}]  # type: ignore[arg-type]

        sources = [{"tool": c["tool"], "input": c["input"]} for c in engine.calls]
        answer, fallback = "\n".join(parts), False
        if req.mode == "agent":
            if use_model:
                answer, fallback = await self._rephrase(answer, facts)
            else:
                fallback = True
        audit = [{"type": "tool.call", **c} for c in engine.calls] + [{"type": "ask.answered", "question": q[:200], "intents": intents, "fallbackUsed": fallback}]
        return AskResponse(answer=answer, sources=sources, traceId=trace_id, fallbackUsed=fallback), audit

    async def _rephrase(self, draft: str, facts: Any) -> tuple[str, bool]:
        if not self.model.available:
            return draft, True
        try:
            out = await asyncio.wait_for(
                self.model.run(agent="Ask", deployment="fast", instructions=ASK_INSTRUCTIONS, prompt=json.dumps({"draft": draft}), output=AskOut),
                self.s.model_timeout_s,
            )
            if numbers_grounded(out.answer, [facts, draft]) and out.answer.strip():
                return out.answer, False
        except Exception:
            pass
        return draft, True

    async def _answer(self, engine: TracedEngine, intent: str, req: AskRequest, tasks: dict[str, Any] | None) -> tuple[str, Any]:
        tick, demo = req.tick, req.demoId
        if intent == "exceptions":
            d = await engine.call("Ask", "get_exceptions", {"tick": tick})
            top = "; ".join(f"{e['id']} ({e['severity']} {e['type']})" for e in d["exceptions"][:5])
            return f"{d['count']} open exceptions at tick {tick}." + (f" Most severe: {top}." if top else ""), d
        if intent == "sla":
            d = await engine.call("Ask", "rank_by_sla", {"tick": tick})
            top = "; ".join(f"#{r['rank']} {r['id']} ({r['severity']})" for r in d["ranked"][:5])
            kp = "; ".join(f"{k['label']}: {k['pct']}% met" if k["pct"] is not None else f"{k['label']}: n/a" for k in d["kpis"])
            return f"SLA ranking: {top or 'no open exceptions'}. {kp}.", d
        if intent == "state":
            d = await engine.call("Ask", "get_live_state", {"tick": tick})
            return f"At tick {tick}: {d['flights']['total']} flights, {d['turnarounds']['total']} turnarounds, {d['tasks']['total']} tasks, {d['openExceptions']} open exceptions.", d
        if intent == "optimizer":
            d = await engine.call("Ask", "run_optimizer", {"tick": tick})
            return f"Optimizer plan: weighted score {d['before']['weightedScore']} → {d['after']['weightedScore']}. " + " ".join(d["summary"][:3]), d
        assert tasks is not None
        if intent == "options":
            lines, comps = [], []
            for t in tasks["tasks"]:
                c = await engine.call("Ask", "compare_options", {"demoId": demo, "taskId": t["id"], "tick": tick})
                comps.append(c)
                label = next(o["label"] for o in c["options"] if o["id"] == c["advice"]["optionId"])
                lines.append(f"{t['id']}: engine recommends '{label}' ({c['advice']['optionId']}). {c['advice']['rationale']}")
            return "\n".join(lines), comps
        decisions: dict[str, str] = {}
        for t in tasks["tasks"]:
            c = await engine.call("Ask", "compare_options", {"demoId": demo, "taskId": t["id"], "tick": tick})
            decisions[t["id"]] = c["advice"]["optionId"]
        k = await engine.call("Ask", "get_kpi_value", {"demoId": demo, "decisions": decisions, "tick": tick})
        return f"Applying the engine's recommended options moves the weighted risk score {k['before']['weighted']} → {k['after']['weighted']} (flights at risk {k['before']['atRisk']} → {k['after']['atRisk']}).", k
