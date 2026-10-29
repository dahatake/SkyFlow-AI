from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Status = Literal["Proposed", "Approved", "Rejected", "Applied"]
Mode = Literal["agent", "rules"]
Confidence = Literal["High", "Medium", "Low"]

DEMO_ID = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$"


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---- API contract -------------------------------------------------------------------------------------------------

class RecItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    taskId: str
    optionId: str
    rationale: str = Field(max_length=800)
    kpiDelta: dict[str, float]  # copied from the engine, never model-written
    confidence: Confidence


class Step(BaseModel):
    model_config = ConfigDict(extra="forbid")
    agent: str
    tool: str | None = None
    status: Literal["ok", "fallback", "error", "skipped"] = "ok"
    durationMs: float = 0.0
    handoffTo: str | None = None
    detail: str | None = None


class Recommendation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    demoId: str
    tick: int = 0
    traceId: str
    status: Status = "Proposed"
    mode: Mode
    fallbackUsed: bool = False
    items: list[RecItem] = Field(default_factory=list)
    steps: list[Step] = Field(default_factory=list)
    teamsCard: dict[str, Any] = Field(default_factory=dict)
    headline: str = ""
    summary: str = ""
    kpi: dict[str, Any] | None = None  # engine before/after/delta for the whole proposal
    exceptionIds: list[str] = Field(default_factory=list)
    createdAt: str = Field(default_factory=utcnow)
    createdBy: str = "anonymous"
    decidedBy: str | None = None
    decidedRole: str | None = None
    decidedAt: str | None = None
    appliedAt: str | None = None


class ProposeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    demoId: str = Field(pattern=DEMO_ID)
    tick: int = Field(default=0, ge=0, le=1440)
    mode: Mode = "agent"


class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    actor: str = Field(min_length=1, max_length=128)
    role: str = Field(min_length=1, max_length=128)


class AskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1, max_length=2000)
    demoId: str = Field(pattern=DEMO_ID)
    tick: int = Field(default=0, ge=0, le=1440)
    mode: Mode = "agent"


class AskResponse(BaseModel):
    answer: str
    refused: bool = False
    sources: list[dict[str, Any]] = Field(default_factory=list)
    traceId: str
    fallbackUsed: bool = False


# ---- structured outputs the models must produce (validated against engine data afterwards) -------------------------

class DetectOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    exceptionIds: list[str] = Field(max_length=50)
    summary: str = Field(max_length=500)


class TriageOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    taskIds: list[str] = Field(min_length=1, max_length=20)
    reason: str = Field(max_length=500)


class Choice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    taskId: str
    optionId: str
    rationale: str = Field(max_length=800)
    confidence: Confidence


class ResolverOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    choices: list[Choice] = Field(min_length=1, max_length=20)


class CommsOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    headline: str = Field(max_length=140)
    summary: str = Field(max_length=600)


class AskOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: str = Field(max_length=1200)
