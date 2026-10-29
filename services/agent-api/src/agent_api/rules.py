"""Deterministic rules-only path: uses the engine's own advise() results and never needs a model."""
from __future__ import annotations

from typing import Any

from .models import Choice, CommsOut, DetectOut, ResolverOut, TriageOut

TOP_N = 20


def detect(excs: dict[str, Any], ranked: dict[str, Any]) -> DetectOut:
    order = [r["id"] for r in ranked.get("ranked", [])]
    by_id = {e["id"]: e for e in excs.get("exceptions", [])}
    urgent = [i for i in order if i in by_id and by_id[i].get("severity") in ("High", "Critical")]
    chosen = (urgent or [i for i in order if i in by_id] or list(by_id))[:TOP_N]
    return DetectOut(exceptionIds=chosen, summary=f"{len(chosen)} of {len(by_id)} open exceptions selected by severity and SLA rank.")


def triage(tasks: dict[str, Any]) -> TriageOut:
    ids = [t["id"] for t in tasks.get("tasks", [])][:TOP_N]
    return TriageOut(taskIds=ids, reason="All decision tasks of the scenario, in engine order.")


def confidence(delta: dict[str, Any]) -> str:
    w = delta.get("weighted", 0)
    return "High" if w <= -10 else "Medium" if w < 0 else "Low"


def resolve(comparisons: list[dict[str, Any]]) -> ResolverOut:
    choices = []
    for c in comparisons:
        opt_id = c["advice"]["optionId"]
        opt = next(o for o in c["options"] if o["id"] == opt_id)
        choices.append(Choice(taskId=c["taskId"], optionId=opt_id, rationale=c["advice"]["rationale"][:800], confidence=confidence(opt["deltaVsNone"])))  # type: ignore[arg-type]
    return ResolverOut(choices=choices)


def comms(tasks: dict[str, Any], items: list[Any], kpi: dict[str, Any]) -> CommsOut:
    title = tasks.get("title") or tasks.get("demoId") or "Scenario"
    act = sum(1 for i in items if i.optionId != "none")
    b, a = kpi.get("before", {}), kpi.get("after", {})
    return CommsOut(
        headline=f"{title}: {act} of {len(items)} decisions recommended"[:140],
        summary=f"Engine weighted risk score {b.get('weighted', 0)} → {a.get('weighted', 0)}; flights at risk {b.get('atRisk', 0)} → {a.get('atRisk', 0)}; breaches {b.get('breach', 0)} → {a.get('breach', 0)}.",
    )
