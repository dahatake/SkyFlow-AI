from __future__ import annotations

from typing import Any

import httpx

from .models import Recommendation


def build_card(rec: Recommendation, api_url: str = "", approver_role: str = "") -> dict[str, Any]:
    """Adaptive Card for a proposal. Built from engine-derived fields only; model text is limited to headline/summary."""
    body: list[dict[str, Any]] = [
        {"type": "TextBlock", "text": rec.headline or f"Proposal {rec.id}", "weight": "Bolder", "size": "Medium", "wrap": True},
        {"type": "TextBlock", "text": rec.summary, "wrap": True, "isSubtle": True},
    ]
    for it in rec.items:
        body.append({
            "type": "Container", "separator": True,
            "items": [
                {"type": "TextBlock", "text": f"{it.taskId} → {it.optionId}", "weight": "Bolder", "wrap": True},
                {"type": "TextBlock", "text": it.rationale, "wrap": True},
                {"type": "FactSet", "facts": [
                    {"title": "Confidence", "value": it.confidence},
                    {"title": "Weighted score change", "value": f"{it.kpiDelta.get('weighted', 0):+g}"},
                    {"title": "Flights at risk change", "value": f"{it.kpiDelta.get('atRisk', 0):+g}"},
                ]},
            ],
        })
    body.append({"type": "FactSet", "facts": [
        {"title": "Status", "value": rec.status}, {"title": "Mode", "value": rec.mode + (" (fallback)" if rec.fallbackUsed else "")},
        {"title": "Trace", "value": rec.traceId},
    ]})
    card: dict[str, Any] = {
        "type": "AdaptiveCard", "$schema": "http://adaptivecards.io/schemas/adaptive-card.json", "version": "1.4", "body": body,
    }
    if api_url:
        base = f"{api_url.rstrip('/')}/api/agent/proposals/{rec.id}"
        payload = lambda: '{"actor":"teams","role":"%s"}' % approver_role  # noqa: E731
        card["actions"] = [
            {"type": "Action.Http", "title": "Approve", "method": "POST", "url": f"{base}/approve",
             "headers": [{"name": "Content-Type", "value": "application/json"}], "body": payload()},
            {"type": "Action.Http", "title": "Reject", "method": "POST", "url": f"{base}/reject",
             "headers": [{"name": "Content-Type", "value": "application/json"}], "body": payload()},
        ]
    return card


async def post_card(webhook_url: str, card: dict[str, Any], timeout_s: float = 5.0) -> bool:
    """Best-effort: never raises."""
    if not webhook_url:
        return False
    envelope = {"type": "message", "attachments": [{"contentType": "application/vnd.microsoft.card.adaptive", "contentUrl": None, "content": card}]}
    try:
        async with httpx.AsyncClient(timeout=timeout_s) as c:
            r = await c.post(webhook_url, json=envelope)
            return r.status_code < 300
    except Exception:
        return False
