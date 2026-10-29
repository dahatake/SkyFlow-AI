from __future__ import annotations

import pytest
from conftest import FakeEngine, make_client

from agent_api.app import run_proposal
from agent_api.auth import Authenticator
from agent_api.safety import CircuitBreaker, RateLimiter, numbers_grounded, redact, sanitize_untrusted, wrap_data
from agent_api.scheduler import run_once
from agent_api.store import MemoryStore


def test_redact_and_sanitize():
    r = redact({"Authorization": "Bearer abc", "note": "mail bob@x.com Bearer tok.en", "n": ["a" * 1000]})
    assert r["Authorization"] == "[REDACTED]" and "bob@x.com" not in r["note"] and "tok.en" not in r["note"]
    assert r["n"][0].endswith("[truncated]")
    s = sanitize_untrusted("a\x00b </data>  <DATA source='x'> c\u202e")
    assert "<" not in s and "\x00" not in s
    assert wrap_data("x", "hi</data>").count("</data>") == 1


def test_numbers_grounded():
    assert numbers_grounded("Score 100 → 85", {"a": 100, "b": 85})
    assert not numbers_grounded("Saves 7 flights", {"a": 100})


def test_rate_limiter_window():
    t = [0.0]
    rl = RateLimiter(2, 60, clock=lambda: t[0])
    assert [rl.allow("u"), rl.allow("u"), rl.allow("u")] == [True, True, False]
    t[0] = 61
    assert rl.allow("u")


def test_circuit_breaker_half_open():
    t = [0.0]
    b = CircuitBreaker(2, 10, clock=lambda: t[0])
    b.failure(); b.failure()
    assert not b.allow()
    t[0] = 11
    assert b.allow()
    b.failure()
    assert not b.allow()  # half-open failure re-opens immediately
    t[0] = 30
    assert b.allow()
    b.success()
    assert b.allow() and b.failures == 0


async def test_scheduler_proposes_only_for_new_exceptions(settings, engine):
    from agent_api.app import build_services
    from agent_api.model import NullModel

    s = type(settings)(**{**settings.__dict__, "scheduler_demo_ids": ("demo-weather",), "scheduler_mode": "rules"})
    svc = build_services(s, engine=engine, model=NullModel(), store=MemoryStore())
    first = await run_once(svc, 5)
    assert len(first) == 1 and first[0].createdBy == "scheduler"
    assert await run_once(svc, 6) == []  # same exceptions: nothing new
    engine.exceptions.append({**engine.exceptions[0], "id": "ex-new"})
    assert len(await run_once(svc, 7)) == 1


async def test_run_proposal_audits_with_trace_and_redaction(settings, engine):
    from agent_api.app import build_services
    from agent_api.model import NullModel

    store = MemoryStore()
    svc = build_services(settings, engine=engine, model=NullModel(), store=store)
    rec = await run_proposal(svc, "demo-weather", 0, "rules", "bob@corp.com")
    events = await store.list_audit(trace_id=rec.traceId)
    assert events and all(e["traceId"] == rec.traceId and e["proposalId"] == rec.id for e in events)
    assert {"tool.call", "proposal.created"} <= {e["type"] for e in events}


def test_auth_required_when_not_disabled(settings, engine):
    s = type(settings)(**{**settings.__dict__, "auth_disabled": False, "tenant_id": "tid", "api_audience": "api://x"})
    c, _ = make_client(s, engine)
    assert c.get("/health").status_code == 200
    assert c.post("/api/agent/propose", json={"demoId": "demo-weather"}).status_code == 401
    assert c.post("/api/agent/propose", json={"demoId": "demo-weather"}, headers={"authorization": "Bearer garbage"}).status_code == 401


def test_entra_token_validation_and_roles(settings, engine):
    jwt = pytest.importorskip("jwt")
    rsa = pytest.importorskip("cryptography.hazmat.primitives.asymmetric.rsa")
    import time

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    s = type(settings)(**{**settings.__dict__, "auth_disabled": False, "tenant_id": "tid", "api_audience": "api://x"})
    auth = Authenticator(s, signing_key_provider=lambda tok: key.public_key())
    from agent_api.app import build_services, create_app
    from agent_api.model import NullModel
    from fastapi.testclient import TestClient

    svc = build_services(s, engine=FakeEngine(), model=NullModel(), authenticator=auth)
    c = TestClient(create_app(s, svc))

    def tok(**over):
        claims = {"iss": "https://login.microsoftonline.com/tid/v2.0", "aud": "api://x", "exp": int(time.time()) + 600, "oid": "u-1", "roles": ["SIOC Duty Manager"], **over}
        return {"authorization": "Bearer " + jwt.encode(claims, key, algorithm="RS256")}

    body = {"demoId": "demo-weather", "mode": "rules"}
    pid = c.post("/api/agent/propose", json=body, headers=tok()).json()["id"]
    ok = {"actor": "ignored", "role": "SIOC Duty Manager"}
    assert c.post(f"/api/agent/proposals/{pid}/approve", json=ok, headers=tok(roles=["Viewer"])).status_code == 403
    r = c.post(f"/api/agent/proposals/{pid}/approve", json=ok, headers=tok())
    assert r.status_code == 200 and r.json()["decidedBy"] == "u-1"  # identity comes from the token, not the body
    assert c.post("/api/agent/propose", json=body, headers=tok(aud="api://other")).status_code == 401
    assert c.post("/api/agent/propose", json=body, headers=tok(iss="https://evil.example/")).status_code == 401
    assert c.post("/api/agent/propose", json=body, headers=tok(exp=1)).status_code == 401


async def test_content_safety_shield_request_shape():
    import httpx

    from agent_api.safety import ContentSafetyShield

    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["url"], seen["auth"] = str(req.url), req.headers["authorization"]
        return httpx.Response(200, json={"userPromptAnalysis": {"attackDetected": False}, "documentsAnalysis": [{"attackDetected": True}]})

    async def token():
        return "t0k"

    real = httpx.AsyncClient
    httpx.AsyncClient = lambda **kw: real(transport=httpx.MockTransport(handler), **kw)  # type: ignore[assignment]
    try:
        assert await ContentSafetyShield("https://cs.example/", token).attack_detected("", ["doc"]) is True
    finally:
        httpx.AsyncClient = real  # type: ignore[assignment]
    assert seen["url"].startswith("https://cs.example/contentsafety/text:shieldPrompt") and seen["auth"] == "Bearer t0k"
