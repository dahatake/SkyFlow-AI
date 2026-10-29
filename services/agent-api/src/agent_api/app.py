from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, Request

from .ask import Asker
from .auth import Authenticator, User
from .config import Settings
from .engine_client import EngineClient, EngineError, McpEngineClient
from .model import AgentFrameworkModel, ModelClient, ModelUnavailable, NullModel
from .models import AskRequest, AskResponse, DecisionRequest, ProposeRequest, Recommendation, utcnow
from .pipeline import Pipeline, new_trace_id
from .safety import CircuitBreaker, ContentSafetyShield, NullShield, RateLimiter, Shield, redact
from .store import MemoryStore, Store, audit_doc
from .teams import post_card
from .telemetry import setup_telemetry

log = logging.getLogger("agent_api")


@dataclass
class Services:
    settings: Settings
    engine: EngineClient
    model: ModelClient
    store: Store
    shield: Shield
    pipeline: Pipeline
    asker: Asker
    limiter: RateLimiter
    authenticator: Authenticator


def build_services(settings: Settings, *, engine: EngineClient | None = None, model: ModelClient | None = None, store: Store | None = None,
                   shield: Shield | None = None, authenticator: Authenticator | None = None) -> Services:
    engine = engine or McpEngineClient(settings.engine_mcp_url)
    if model is None:
        try:
            model = AgentFrameworkModel(settings)
        except ModelUnavailable:
            model = NullModel()
    if store is None:
        if settings.cosmos_endpoint:
            from .store import CosmosStore

            store = CosmosStore(settings.cosmos_endpoint, settings.cosmos_database)
        else:
            store = MemoryStore()
    if shield is None:
        shield = ContentSafetyShield(settings.content_safety_endpoint) if settings.content_safety_endpoint else NullShield()
    breaker = CircuitBreaker(settings.breaker_threshold, settings.breaker_cooldown_s)
    return Services(
        settings, engine, model, store, shield, Pipeline(settings, engine, model, shield, breaker), Asker(settings, engine, model, shield),
        RateLimiter(settings.rate_limit_per_min), authenticator or Authenticator(settings),
    )


async def run_proposal(svc: Services, demo_id: str, tick: int, mode: str, user: str) -> Recommendation:
    """Shared by the HTTP endpoint and the scheduler: run the pipeline, persist, audit, notify Teams (best effort)."""
    rec, audit = await svc.pipeline.propose(demo_id, tick, mode, user)  # type: ignore[arg-type]
    await svc.store.save_proposal(rec)
    for ev in audit:
        await svc.store.add_audit(audit_doc(ev, demo_id, rec.traceId, rec.id, user))
    await svc.store.add_audit(audit_doc({"type": "proposal.created", "mode": mode, "fallbackUsed": rec.fallbackUsed, "items": redact([i.model_dump() for i in rec.items])}, demo_id, rec.traceId, rec.id, user))
    if svc.settings.teams_webhook_url:
        try:
            ok = await post_card(svc.settings.teams_webhook_url, rec.teamsCard)
            await svc.store.add_audit(audit_doc({"type": "teams.posted", "ok": ok}, demo_id, rec.traceId, rec.id))
        except Exception:  # never fail the request because of notifications
            log.exception("teams notification failed")
    return rec


def create_app(settings: Settings | None = None, services: Services | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    setup_telemetry(settings)
    svc = services or build_services(settings)
    app = FastAPI(title="SkyFlow agent API", version="0.1.0")
    app.state.services = svc

    async def current_user(request: Request) -> User:
        return await svc.authenticator(request)

    def limit(user: User) -> None:
        if not svc.limiter.allow(user.id):
            raise HTTPException(429, "Rate limit exceeded", headers={"Retry-After": "60"})

    @app.get("/health")
    @app.get("/api/health")
    async def health() -> dict[str, Any]:
        return {"status": "ok", "model": "configured" if svc.model.available else "rules-only", "store": type(svc.store).__name__, "authDisabled": settings.auth_disabled}

    @app.post("/api/agent/propose", response_model=Recommendation)
    async def propose(body: ProposeRequest, user: User = Depends(current_user)) -> Recommendation:
        limit(user)
        try:
            return await run_proposal(svc, body.demoId, body.tick, body.mode, user.name or user.id)
        except EngineError as e:
            raise HTTPException(404 if e.code in ("unknown_demo", "unknown_task") else 502, f"Engine error: {e.code}") from e

    @app.get("/api/agent/proposals", response_model=list[Recommendation])
    async def list_proposals(demoId: str | None = None, status: str | None = Query(default=None, pattern="^(Proposed|Approved|Rejected|Applied)$"),
                             limit_: int = Query(default=50, alias="limit", ge=1, le=200), user: User = Depends(current_user)) -> list[Recommendation]:
        return await svc.store.list_proposals(demoId, status, limit_)

    @app.get("/api/agent/proposals/{proposal_id}", response_model=Recommendation)
    async def get_proposal(proposal_id: str, user: User = Depends(current_user)) -> Recommendation:
        rec = await svc.store.get_proposal(proposal_id)
        if not rec:
            raise HTTPException(404, "Proposal not found")
        return rec

    async def decide(proposal_id: str, body: DecisionRequest, user: User, action: str) -> Recommendation:
        if body.role not in settings.approver_roles:
            raise HTTPException(403, "Role is not allowed to decide proposals")
        if not settings.auth_disabled and body.role not in user.roles:
            raise HTTPException(403, "Token does not carry the claimed role")
        actor = (user.name or user.id) if not settings.auth_disabled else body.actor
        allowed_from, new_status, extra = {
            "approve": ({"Proposed"}, "Approved", {}),
            "reject": ({"Proposed"}, "Rejected", {}),
            "apply": ({"Approved"}, "Applied", {"appliedAt": utcnow()}),
        }[action]
        updates = {"status": new_status, **extra} if action == "apply" else {"status": new_status, "decidedBy": actor, "decidedRole": body.role, "decidedAt": utcnow()}
        rec = await svc.store.transition(proposal_id, allowed_from, updates)
        if rec is None:
            if await svc.store.get_proposal(proposal_id) is None:
                raise HTTPException(404, "Proposal not found")
            raise HTTPException(409, f"Proposal cannot be {new_status.lower()} from its current status")
        await svc.store.add_audit(audit_doc(
            {"type": f"proposal.{new_status.lower()}", "role": body.role, "decisions": {i.taskId: i.optionId for i in rec.items}},
            rec.demoId, rec.traceId, rec.id, actor,
        ))
        return rec

    @app.post("/api/agent/proposals/{proposal_id}/approve", response_model=Recommendation)
    async def approve(proposal_id: str, body: DecisionRequest, user: User = Depends(current_user)) -> Recommendation:
        return await decide(proposal_id, body, user, "approve")

    @app.post("/api/agent/proposals/{proposal_id}/reject", response_model=Recommendation)
    async def reject(proposal_id: str, body: DecisionRequest, user: User = Depends(current_user)) -> Recommendation:
        return await decide(proposal_id, body, user, "reject")

    @app.post("/api/agent/proposals/{proposal_id}/apply", response_model=Recommendation)
    async def apply(proposal_id: str, body: DecisionRequest, user: User = Depends(current_user)) -> Recommendation:
        return await decide(proposal_id, body, user, "apply")

    @app.get("/api/agent/proposals/{proposal_id}/audit")
    async def audit(proposal_id: str, user: User = Depends(current_user)) -> list[dict[str, Any]]:
        return await svc.store.list_audit(proposal_id=proposal_id)

    @app.post("/api/agent/ask", response_model=AskResponse)
    async def ask(body: AskRequest, user: User = Depends(current_user)) -> AskResponse:
        if len(body.question) > settings.max_input_chars:
            raise HTTPException(422, f"question exceeds {settings.max_input_chars} characters")
        limit(user)
        resp, audit_events = await svc.asker.ask(body)
        for ev in audit_events:
            await svc.store.add_audit(audit_doc(ev, body.demoId, resp.traceId, None, user.name or user.id))
        return resp

    return app
