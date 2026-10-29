from __future__ import annotations

from typing import Protocol, TypeVar

from pydantic import BaseModel

from .config import Settings
from .engine_client import ALLOWED_TOOLS

T = TypeVar("T", bound=BaseModel)

READ_ONLY_TOOLS = sorted(ALLOWED_TOOLS)


class ModelUnavailable(Exception):
    """No model is configured or reachable; callers fall back to the deterministic rules."""


class ModelClient(Protocol):
    available: bool

    async def run(self, *, agent: str, deployment: str, instructions: str, prompt: str, output: type[T], use_engine_tools: bool = False) -> T:
        """deployment is 'primary' or 'fast'. Must return a validated `output` instance or raise."""
        ...


class NullModel:
    available = False

    async def run(self, **_: object):  # type: ignore[override]
        raise ModelUnavailable("no model configured")


class AgentFrameworkModel:
    """Microsoft Agent Framework agent per call, Foundry chat client, DefaultAzureCredential, temperature 0.

    Everything Azure/agent related is imported lazily so the rest of the service runs (rules mode) without it.
    """

    available = True

    def __init__(self, settings: Settings):
        if not settings.model_configured:
            raise ModelUnavailable("FOUNDRY_PROJECT_ENDPOINT / FOUNDRY_MODEL_PRIMARY not set")
        self.s = settings
        self._credential = None
        self._clients: dict[str, object] = {}

    def _client(self, deployment: str):
        if deployment not in self._clients:
            try:
                from agent_framework.foundry import FoundryChatClient
                from azure.identity.aio import DefaultAzureCredential
            except ImportError as e:
                raise ModelUnavailable(f"agent-framework / azure-identity not installed: {e}") from e
            self._credential = self._credential or DefaultAzureCredential()
            model = self.s.model_fast if deployment == "fast" else self.s.model_primary
            self._clients[deployment] = FoundryChatClient(
                project_endpoint=self.s.foundry_project_endpoint, model=model, credential=self._credential,
            )
        return self._clients[deployment]

    async def run(self, *, agent: str, deployment: str, instructions: str, prompt: str, output: type[T], use_engine_tools: bool = False) -> T:
        try:
            from agent_framework import Agent, MCPStreamableHTTPTool
        except ImportError as e:
            raise ModelUnavailable(f"agent-framework not installed: {e}") from e
        options = {"response_format": output, "temperature": 0, "max_tokens": self.s.max_output_tokens}
        tool = None
        if use_engine_tools:
            # Read-only engine tools with a fixed allow-list; a resolver may look up more engine facts but cannot widen the set.
            tool = MCPStreamableHTTPTool(
                name="skyflow-engine", url=self.s.engine_mcp_url, allowed_tools=READ_ONLY_TOOLS,
                approval_mode="never_require", request_timeout=int(self.s.engine_timeout_s),
            )
        agent_obj = Agent(self._client(deployment), instructions, name=agent, tools=[tool] if tool else None, default_options=options)
        if tool is not None:
            async with tool:
                resp = await agent_obj.run(prompt)
        else:
            resp = await agent_obj.run(prompt)
        value = getattr(resp, "value", None)
        if isinstance(value, output):
            return value
        return output.model_validate_json(resp.text)
