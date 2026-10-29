"""Scheduled trigger: `python -m agent_api.scheduler` (Container Apps job). Runs Detect and proposes for new exceptions."""
from __future__ import annotations

import asyncio
import logging
import os
import time

from .app import Services, build_services, run_proposal
from .config import Settings
from .engine_client import EngineError
from .models import Recommendation
from .telemetry import setup_telemetry

log = logging.getLogger("agent_api.scheduler")


def current_tick() -> int:
    if os.environ.get("SCHEDULER_TICK"):
        return max(0, min(1440, int(os.environ["SCHEDULER_TICK"])))
    return int(time.time() // 60) % 1441


async def run_once(svc: Services, tick: int | None = None) -> list[Recommendation]:
    tick = current_tick() if tick is None else tick
    created: list[Recommendation] = []
    for demo_id in svc.settings.scheduler_demo_ids:
        try:
            # Detect: exceptions already covered by an earlier proposal for this scenario are not new.
            excs = await svc.engine.call("get_exceptions", {"tick": tick})
            current = {e["id"] for e in excs.get("exceptions", [])}
            seen = {i for p in await svc.store.list_proposals(demo_id, limit=200) for i in p.exceptionIds}
            if not (current - seen):
                log.info("%s: no new exceptions at tick %s", demo_id, tick)
                continue
            created.append(await run_proposal(svc, demo_id, tick, svc.settings.scheduler_mode, "scheduler"))
        except EngineError as e:
            log.error("%s: engine error %s", demo_id, e.code)
    return created


def main() -> int:
    logging.basicConfig(level=logging.INFO)
    settings = Settings.from_env()
    setup_telemetry(settings)
    created = asyncio.run(run_once(build_services(settings)))
    log.info("created %d proposal(s): %s", len(created), [c.id for c in created])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
