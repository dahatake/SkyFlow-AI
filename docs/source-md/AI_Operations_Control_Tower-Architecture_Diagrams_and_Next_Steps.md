<!-- Slide number: 1 -->

SATS PROJECT SPEAR  ·  USE CASE 2

AI Operations
Control Tower
To-Be architecture diagrams
and next steps
Prototype and production target, mapped to functional and non-functional requirements

Next steps: slides 2 and 10

Draft for validation  ·  28 October 2026

### Notes:
Cover. Architecture diagrams for the AI Operations Control Tower (Use Case 2) and the next steps to reach the MVP build. Built from the Requirements Definition and the Solution Envisioning Output. Cover photograph is generated imagery, illustrative only.

<!-- Slide number: 2 -->
APPROACH

One UI, two data horizons

![Two horizons: browser-only prototype now and Fabric Real-Time Intelligence production, joined by a data-provider interface, with a four-phase roadmap.](Picture93.jpg)
Source: Requirements Definition sections 1 and 13; Solution Envisioning Output slides 14, 16 and 17

### Notes:
The requirements definition scopes a browser-storage prototype; the envisioning output defines the Fabric production target. The data-provider interface from requirements section 13 lets a Fabric adapter replace the seed provider without rewriting the screens. Roadmap is proposed and to be confirmed.

<!-- Slide number: 3 -->
TO-BE · HORIZON 1

Prototype runs entirely in the browser

![Prototype architecture: presentation row, shared view context, core services, IndexedDB and localStorage, data-provider interface, hosted on Azure Static Web Apps.](Picture139.jpg)
Source: Requirements Definition sections 8, 10 and 13; Microsoft Learn: What is Azure Static Web Apps?

### Notes:
Component split follows Requirements Definition section 13. IndexedDB holds entities and scenarios; localStorage holds small preferences only (DATA-002). Azure Static Web Apps hosting is a design proposal, not stated in the source.

<!-- Slide number: 4 -->
TO-BE · SIMULATOR

What-if runs beside the baseline

![Simulator flow: baseline snapshot and scenario parameters, validation, scenario engine, derived overlay, and Baseline, Scenario and Difference views, with scenario store in IndexedDB.](Picture140.jpg)
Source: Requirements Definition sections 6, 8 and 12 (SIM-001 to SIM-004, DATA-003, AT-03, AT-04, AT-07)

### Notes:
The scenario engine only reads the baseline. Invalid parameters show a message and leave the view unchanged (AT-04). Baseline remains byte-equivalent after apply, refresh or deletion.

<!-- Slide number: 5 -->
TO-BE · 2D / 3D

One selection drives every view

![Coordinated views: shared view context linking KPI strip, board and queue, 2D map and 3D scene, with rendering rules.](Picture141.jpg)
Source: Requirements Definition section 5 (VIZ-001 to VIZ-006), FR-006, NFR-002; production option: Microsoft Learn, What is Fabric Maps?

### Notes:
Toggling 2D and 3D preserves filters, selection, time position and simulation context (VIZ-001, AT-02). In production, Fabric Maps can render live Eventhouse queries and Lakehouse reference data as layers.

<!-- Slide number: 6 -->
TO-BE · HORIZON 2

Fabric surrounds today's systems

![Production architecture: sources, ingest, Microsoft Fabric (Eventhouse, Lakehouse, ops model, Activator), experiences and users, governed by Entra ID, row-level security and Purview.](Picture220.jpg)
Source: Solution Envisioning Output slides 14-16; Microsoft Learn: Real-Time Intelligence overview, Fabric Activator, Fabric data agent in Copilot Studio

### Notes:
Aligned to the envisioning target architecture (surround, not replace). Added: the same control tower web app reading Fabric through the data-provider adapter, and an ops model expressed as a Fabric ontology (ontology and digital twin builder are in preview). Reference pattern: Azure Architecture Center, Real-time analytics with Azure Service Bus and Microsoft Fabric.

<!-- Slide number: 7 -->
TO-BE · RUNTIME FLOW

Exceptions reach an owner in minutes

![Six-step flow: Eventstreams sense, Activator detects, Power Automate routes, Teams Adaptive Card notifies, owner acts, OneLake audits; with 2 minute, 5 minute and five-rule targets.](Picture221.jpg)
Source: Solution Envisioning Output slides 3, 11, 14 and 17; Microsoft Learn: What is Fabric Activator?

### Notes:
Targets come from the envisioning output and are to be confirmed with SATS. Write-back to GroundStar and G-Ops is phase 2; the prototype has no write-back (NFR-005).

<!-- Slide number: 8 -->
NON-FUNCTIONAL REQUIREMENTS

Each quality target has an answer

![Seven non-functional design answers: performance, accessibility, responsive, explainability, safety boundary, observability, identity and access; plus a data residency check before phase 2.](Picture222.jpg)
Source: Requirements Definition section 10; Microsoft Learn guidance named on each card

### Notes:
Fabric data agent responses consumed in Copilot Studio might be sent outside the Fabric compliance boundary or region (Microsoft Learn). Validate against the Singapore residency decision before phase 2.

<!-- Slide number: 9 -->
NEXT STEPS  ·  OWNERS AND DECISIONS

Next steps: owners and decisions

![Three architecture design sessions with the decisions each must close, and what each owner must deliver, ending with the 11 Jan 2027 build start.](Picture223.jpg)
Source: Solution Envisioning Output slides 15 and 18; Requirements Definition section 15

### Notes:
Highest priority: SATS Control Tower Lead confirms MVP scope by 13 Nov. Per-owner asks are derived from the envisioning next steps and the open decisions in both documents.