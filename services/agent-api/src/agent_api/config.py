from __future__ import annotations

import os
from dataclasses import dataclass


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def _csv(name: str, default: str) -> tuple[str, ...]:
    return tuple(x.strip() for x in os.environ.get(name, default).split(",") if x.strip())


DEFAULT_APPROVER_ROLES = ("SIOC Duty Manager", "Control Tower Lead", "BU Ops Manager")
DEFAULT_DEMO_IDS = ("demo-weather", "demo-flight-delay", "demo-no-staff")


@dataclass(frozen=True)
class Settings:
    auth_disabled: bool = False
    tenant_id: str = ""
    api_audience: str = ""
    approver_roles: tuple[str, ...] = DEFAULT_APPROVER_ROLES
    engine_mcp_url: str = "http://localhost:8080/mcp"
    foundry_project_endpoint: str = ""
    model_primary: str = ""
    model_fast: str = ""
    content_safety_endpoint: str = ""
    cosmos_endpoint: str = ""
    cosmos_database: str = "skyflow"
    teams_webhook_url: str = ""
    public_api_url: str = ""
    appinsights_connection_string: str = ""
    rate_limit_per_min: int = 10
    max_input_chars: int = 500
    model_timeout_s: float = 20.0
    pipeline_timeout_s: float = 60.0
    engine_timeout_s: float = 10.0
    max_output_tokens: int = 800
    retry_budget: int = 1
    breaker_threshold: int = 3
    breaker_cooldown_s: float = 60.0
    scheduler_demo_ids: tuple[str, ...] = DEFAULT_DEMO_IDS
    scheduler_mode: str = "agent"

    @property
    def model_configured(self) -> bool:
        return bool(self.foundry_project_endpoint and self.model_primary)

    @classmethod
    def from_env(cls) -> "Settings":
        e = os.environ.get
        d = cls()
        return cls(
            auth_disabled=_bool("AUTH_DISABLED"),
            tenant_id=e("TENANT_ID", ""),
            api_audience=e("API_AUDIENCE", ""),
            approver_roles=_csv("APPROVER_ROLES", ",".join(DEFAULT_APPROVER_ROLES)),
            engine_mcp_url=e("ENGINE_MCP_URL", d.engine_mcp_url),
            foundry_project_endpoint=e("FOUNDRY_PROJECT_ENDPOINT", ""),
            model_primary=e("FOUNDRY_MODEL_PRIMARY", ""),
            model_fast=e("FOUNDRY_MODEL_FAST", "") or e("FOUNDRY_MODEL_PRIMARY", ""),
            content_safety_endpoint=e("CONTENT_SAFETY_ENDPOINT", "").rstrip("/"),
            cosmos_endpoint=e("COSMOS_ENDPOINT", ""),
            cosmos_database=e("COSMOS_DATABASE", d.cosmos_database),
            teams_webhook_url=e("TEAMS_WEBHOOK_URL", ""),
            public_api_url=e("PUBLIC_API_URL", "").rstrip("/"),
            appinsights_connection_string=e("APPLICATIONINSIGHTS_CONNECTION_STRING", ""),
            rate_limit_per_min=_int("RATE_LIMIT_PER_MIN", d.rate_limit_per_min),
            max_input_chars=_int("MAX_INPUT_CHARS", d.max_input_chars),
            model_timeout_s=_float("MODEL_TIMEOUT_S", d.model_timeout_s),
            pipeline_timeout_s=_float("PIPELINE_TIMEOUT_S", d.pipeline_timeout_s),
            engine_timeout_s=_float("ENGINE_TIMEOUT_S", d.engine_timeout_s),
            max_output_tokens=_int("MAX_OUTPUT_TOKENS", d.max_output_tokens),
            retry_budget=_int("MODEL_RETRY_BUDGET", d.retry_budget),
            breaker_threshold=_int("BREAKER_THRESHOLD", d.breaker_threshold),
            breaker_cooldown_s=_float("BREAKER_COOLDOWN_S", d.breaker_cooldown_s),
            scheduler_demo_ids=_csv("SCHEDULER_DEMO_IDS", ",".join(DEFAULT_DEMO_IDS)),
            scheduler_mode=e("SCHEDULER_MODE", d.scheduler_mode),
        )
