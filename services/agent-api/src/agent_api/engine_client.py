from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Protocol

from .safety import redact

# The only tools any agent path may use. Fixed in code, so data (e.g. flight remarks) can never widen it.
ALLOWED_TOOLS = frozenset({
    "get_live_state", "get_exceptions", "rank_by_sla", "list_decision_tasks",
    "run_scenario", "compare_options", "run_optimizer", "get_kpi_value",
})


class EngineError(Exception):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.code, self.details = code, details or {}


class EngineClient(Protocol):
    async def call(self, tool: str, args: dict[str, Any]) -> dict[str, Any]: ...


class McpEngineClient:
    """Calls the engine-mcp server over streamable HTTP. The engine is stateless, so one short session per call."""

    def __init__(self, url: str):
        self.url = url

    async def call(self, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        from mcp import ClientSession

        try:
            from mcp.client.streamable_http import streamablehttp_client as http_client
        except ImportError:  # newer mcp releases
            from mcp.client.streamable_http import streamable_http_client as http_client  # type: ignore[no-redef]

        async with http_client(self.url) as streams:
            async with ClientSession(streams[0], streams[1]) as session:
                await session.initialize()
                res = await session.call_tool(tool, args)
        data = getattr(res, "structuredContent", None)
        if not data:
            text = next((c.text for c in res.content if getattr(c, "text", None)), "{}")
            data = json.loads(text)
        if res.isError:
            err = data.get("error", {}) if isinstance(data, dict) else {}
            raise EngineError(err.get("code", "tool_error"), err.get("message", "engine tool error"), err)
        return data


class TracedEngine:
    """Allow-lists tools, bounds each call by a timeout, and records every call (redacted) for steps and audit."""

    def __init__(self, client: EngineClient, timeout_s: float = 10.0):
        self.client, self.timeout = client, timeout_s
        self.calls: list[dict[str, Any]] = []

    async def call(self, agent: str, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        if tool not in ALLOWED_TOOLS:
            raise EngineError("tool_not_allowed", f"Tool '{tool}' is not in the allow-list")
        t0 = time.perf_counter()
        rec: dict[str, Any] = {"agent": agent, "tool": tool, "input": redact(args)}
        try:
            out = await asyncio.wait_for(self.client.call(tool, args), self.timeout)
            rec["output"] = redact(out, 200)
            return out
        except EngineError as e:
            rec["error"] = {"code": e.code, "message": str(e)}
            raise
        except asyncio.TimeoutError as e:
            rec["error"] = {"code": "timeout"}
            raise EngineError("engine_timeout", f"Engine tool '{tool}' timed out") from e
        except Exception as e:  # transport failure
            rec["error"] = {"code": "engine_unavailable", "message": str(e)[:200]}
            raise EngineError("engine_unavailable", f"Engine unavailable: {type(e).__name__}") from e
        finally:
            rec["durationMs"] = round((time.perf_counter() - t0) * 1000, 2)
            self.calls.append(rec)
