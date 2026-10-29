from __future__ import annotations

import asyncio
import copy
import uuid
from typing import Any, Protocol

from .models import Recommendation, utcnow


class Store(Protocol):
    async def save_proposal(self, rec: Recommendation) -> None: ...
    async def get_proposal(self, proposal_id: str) -> Recommendation | None: ...
    async def list_proposals(self, demo_id: str | None = None, status: str | None = None, limit: int = 50) -> list[Recommendation]: ...
    async def transition(self, proposal_id: str, allowed_from: set[str], updates: dict[str, Any]) -> Recommendation | None:
        """Atomically apply `updates` if the current status is in `allowed_from`; None when not found or not allowed."""
        ...
    async def add_audit(self, event: dict[str, Any]) -> None: ...
    async def list_audit(self, trace_id: str | None = None, proposal_id: str | None = None, limit: int = 200) -> list[dict[str, Any]]: ...


def audit_doc(event: dict[str, Any], demo_id: str, trace_id: str, proposal_id: str | None = None, actor: str = "system") -> dict[str, Any]:
    return {"id": uuid.uuid4().hex, "demoId": demo_id, "traceId": trace_id, "proposalId": proposal_id, "actor": actor, "at": utcnow(), **event}


class MemoryStore:
    def __init__(self) -> None:
        self._proposals: dict[str, dict[str, Any]] = {}
        self._audit: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def save_proposal(self, rec: Recommendation) -> None:
        async with self._lock:
            self._proposals[rec.id] = rec.model_dump()

    async def get_proposal(self, proposal_id: str) -> Recommendation | None:
        d = self._proposals.get(proposal_id)
        return Recommendation.model_validate(copy.deepcopy(d)) if d else None

    async def list_proposals(self, demo_id: str | None = None, status: str | None = None, limit: int = 50) -> list[Recommendation]:
        rows = [d for d in self._proposals.values() if (not demo_id or d["demoId"] == demo_id) and (not status or d["status"] == status)]
        rows.sort(key=lambda d: d["createdAt"], reverse=True)
        return [Recommendation.model_validate(copy.deepcopy(d)) for d in rows[:limit]]

    async def transition(self, proposal_id: str, allowed_from: set[str], updates: dict[str, Any]) -> Recommendation | None:
        async with self._lock:
            d = self._proposals.get(proposal_id)
            if not d or d["status"] not in allowed_from:
                return None
            d.update(updates)
            return Recommendation.model_validate(copy.deepcopy(d))

    async def add_audit(self, event: dict[str, Any]) -> None:
        self._audit.append(copy.deepcopy(event))

    async def list_audit(self, trace_id: str | None = None, proposal_id: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        rows = [e for e in self._audit if (not trace_id or e.get("traceId") == trace_id) and (not proposal_id or e.get("proposalId") == proposal_id)]
        return copy.deepcopy(rows[-limit:])


class CosmosStore:
    """Cosmos DB (NoSQL) store. Containers `proposals` and `audit`, partition key /demoId, managed identity auth.

    Containers are provisioned by infrastructure; this class only reads and writes documents.
    """

    def __init__(self, endpoint: str, database: str = "skyflow", credential: Any = None):
        from azure.cosmos.aio import CosmosClient

        if credential is None:
            from azure.identity.aio import DefaultAzureCredential

            credential = DefaultAzureCredential()
        self._client = CosmosClient(endpoint, credential=credential)
        db = self._client.get_database_client(database)
        self._proposals = db.get_container_client("proposals")
        self._audit = db.get_container_client("audit")

    async def save_proposal(self, rec: Recommendation) -> None:
        await self._proposals.upsert_item(rec.model_dump())

    async def _find(self, proposal_id: str) -> dict[str, Any] | None:
        q = self._proposals.query_items("SELECT * FROM c WHERE c.id = @id", parameters=[{"name": "@id", "value": proposal_id}])
        async for item in q:
            return item
        return None

    async def get_proposal(self, proposal_id: str) -> Recommendation | None:
        d = await self._find(proposal_id)
        return Recommendation.model_validate(_strip(d)) if d else None

    async def list_proposals(self, demo_id: str | None = None, status: str | None = None, limit: int = 50) -> list[Recommendation]:
        where, params = [], []
        if demo_id:
            where.append("c.demoId = @d"); params.append({"name": "@d", "value": demo_id})
        if status:
            where.append("c.status = @s"); params.append({"name": "@s", "value": status})
        sql = f"SELECT TOP {int(limit)} * FROM c" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY c.createdAt DESC"
        return [Recommendation.model_validate(_strip(i)) async for i in self._proposals.query_items(sql, parameters=params)]

    async def transition(self, proposal_id: str, allowed_from: set[str], updates: dict[str, Any]) -> Recommendation | None:
        from azure.core import MatchConditions
        from azure.cosmos.exceptions import CosmosAccessConditionFailedError

        d = await self._find(proposal_id)
        if not d or d["status"] not in allowed_from:
            return None
        etag = d["_etag"]
        d.update(updates)
        try:
            await self._proposals.replace_item(d["id"], d, etag=etag, match_condition=MatchConditions.IfNotModified)
        except CosmosAccessConditionFailedError:
            return None  # lost a race with another decision
        return Recommendation.model_validate(_strip(d))

    async def add_audit(self, event: dict[str, Any]) -> None:
        await self._audit.upsert_item(event)

    async def list_audit(self, trace_id: str | None = None, proposal_id: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        where, params = [], []
        if trace_id:
            where.append("c.traceId = @t"); params.append({"name": "@t", "value": trace_id})
        if proposal_id:
            where.append("c.proposalId = @p"); params.append({"name": "@p", "value": proposal_id})
        sql = f"SELECT TOP {int(limit)} * FROM c" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY c.at DESC"
        return [_strip(i) async for i in self._audit.query_items(sql, parameters=params)]


def _strip(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if not k.startswith("_")}
