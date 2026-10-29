from __future__ import annotations

import logging

from .config import Settings

log = logging.getLogger("agent_api")


def setup_telemetry(settings: Settings) -> bool:
    """Export traces to Application Insights when a connection string is set. Never raises."""
    if not settings.appinsights_connection_string:
        return False
    try:
        from azure.monitor.opentelemetry import configure_azure_monitor

        configure_azure_monitor(connection_string=settings.appinsights_connection_string)
    except Exception as e:  # missing package or bad config must not stop the API
        log.warning("Application Insights tracing disabled: %s", e)
        return False
    try:
        from agent_framework.observability import enable_instrumentation

        enable_instrumentation()
    except Exception:
        pass
    return True
