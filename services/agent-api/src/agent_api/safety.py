from __future__ import annotations

import json
import re
import time
from collections import defaultdict, deque
from typing import Any, Callable, Protocol

import httpx

SECRET_KEY = re.compile(r"(secret|token|password|passwd|authorization|api[-_]?key|credential|connection[-_]?string)", re.I)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
BEARER = re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]+")
CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069]")
DATA_TAG = re.compile(r"</?\s*data\b[^>]*>", re.I)
NUMBER = re.compile(r"\d+(?:\.\d+)?")
INJECTION = re.compile(
    r"(ignore|disregard|forget|override)\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier|system)?\s*(instructions?|prompts?|rules?)"
    r"|system\s+prompt|you\s+are\s+now|developer\s+mode|jailbreak|reveal\s+(your|the)\s+(prompt|instructions)",
    re.I,
)


def redact(obj: Any, max_str: int = 400) -> Any:
    """Copy of obj that is safe to persist: secrets, emails and bearer tokens removed, long strings truncated."""
    if isinstance(obj, dict):
        return {k: ("[REDACTED]" if SECRET_KEY.search(str(k)) else redact(v, max_str)) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [redact(v, max_str) for v in obj[:100]]
    if isinstance(obj, str):
        s = BEARER.sub("Bearer [REDACTED]", EMAIL.sub("[EMAIL]", obj))
        return s if len(s) <= max_str else s[:max_str] + "…[truncated]"
    return obj


def sanitize_untrusted(text: Any, max_len: int = 300) -> str:
    """Make free text (flight remarks, notes, exception explanations) safe to embed as data in a prompt."""
    s = CONTROL.sub(" ", str(text if text is not None else ""))
    s = DATA_TAG.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:max_len]


def wrap_data(source: str, text: Any, max_len: int = 300) -> str:
    return f'<data source="{source}">{sanitize_untrusted(text, max_len)}</data>'


def looks_like_injection(text: str) -> bool:
    return bool(INJECTION.search(text or ""))


def numbers_in(text: str) -> set[str]:
    return set(NUMBER.findall(text or ""))


def numbers_grounded(text: str, facts: Any) -> bool:
    """True when every number in model-written text also occurs in the engine facts it was given."""
    allowed = numbers_in(json.dumps(facts, default=str))
    return numbers_in(text) <= allowed


class RateLimiter:
    """Sliding-window limiter keyed by user."""

    def __init__(self, limit: int, window_s: float = 60.0, clock: Callable[[], float] = time.monotonic):
        self.limit, self.window, self.clock = limit, window_s, clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = self.clock()
        q = self._hits[key]
        while q and now - q[0] >= self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True


class CircuitBreaker:
    def __init__(self, threshold: int = 3, cooldown_s: float = 60.0, clock: Callable[[], float] = time.monotonic):
        self.threshold, self.cooldown, self.clock = threshold, cooldown_s, clock
        self.failures = 0
        self.opened_at: float | None = None

    @property
    def is_open(self) -> bool:
        return self.opened_at is not None and self.clock() - self.opened_at < self.cooldown

    def allow(self) -> bool:
        if self.opened_at is not None and self.clock() - self.opened_at >= self.cooldown:
            self.opened_at, self.failures = None, self.threshold - 1  # half-open: a single failure re-opens
        return not self.is_open

    def success(self) -> None:
        self.failures, self.opened_at = 0, None

    def failure(self) -> None:
        self.failures += 1
        if self.failures >= self.threshold:
            self.opened_at = self.clock()


class Shield(Protocol):
    async def attack_detected(self, user_prompt: str, documents: list[str]) -> bool: ...


class NullShield:
    async def attack_detected(self, user_prompt: str, documents: list[str]) -> bool:
        return False


class ContentSafetyShield:
    """Azure AI Content Safety Prompt Shields. Raises on service errors so callers can fail closed."""

    API = "2024-09-01"

    def __init__(self, endpoint: str, token_provider: Callable[[], Any] | None = None, timeout_s: float = 5.0):
        self.endpoint, self.timeout = endpoint.rstrip("/"), timeout_s
        self._token_provider = token_provider
        self._credential: Any = None

    async def _token(self) -> str:
        if self._token_provider:
            return await self._token_provider()
        if self._credential is None:
            from azure.identity.aio import DefaultAzureCredential

            self._credential = DefaultAzureCredential()
        return (await self._credential.get_token("https://cognitiveservices.azure.com/.default")).token

    async def attack_detected(self, user_prompt: str, documents: list[str]) -> bool:
        body = {"userPrompt": user_prompt[:10000], "documents": [d[:10000] for d in documents[:5]]}
        async with httpx.AsyncClient(timeout=self.timeout) as c:
            r = await c.post(
                f"{self.endpoint}/contentsafety/text:shieldPrompt", params={"api-version": self.API},
                json=body, headers={"Authorization": f"Bearer {await self._token()}"},
            )
            r.raise_for_status()
            j = r.json()
        return bool(j.get("userPromptAnalysis", {}).get("attackDetected")) or any(
            d.get("attackDetected") for d in j.get("documentsAnalysis", [])
        )
