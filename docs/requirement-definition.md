|  |
| --- |
| **APPLICATION REQUIREMENTS DEFINITION AI Operations Control Tower** Prototype for Changi Airport ground-handling operations  Scope: Use Case 2 only | browser-storage prototype | view-only simulation | 2D/3D operational understanding |

Grounded in the attached business-envisioning material. This document converts the stated business issues into an implementable prototype specification and explicitly labels added design requirements.

# Document intent

Define a software-engineering backlog-ready requirement baseline for an AI Operations Control Tower that gives operations stakeholders one coherent source of operational truth, exposes exceptions and ownership clearly, supports non-destructive what-if simulation, and makes dense airport-operational relationships understandable through coordinated 2D and 3D views.

# 1. Business context and scope

The source material describes fragmented visibility across SIOC, BU Ops and Ground Ops, coordination through walkies/WhatsApp/phones, late exception detection, unclear action ownership, and side-by-side monitoring of DSM, DCT, G-Ops and Mosaic. The intended outcome is a single pane of glass for flights, turnarounds, staff, equipment and SLA risk, with role-relevant drill-down and accountable action trails.

| **Scope item** | **Requirement baseline** |
| --- | --- |
| Primary business use case | AI operations control tower only (Use Case 2). |
| Primary stakeholder | Control Tower Lead / Head of SIOC (name remains TBC in the source). |
| Core personas | Control Tower Lead, SIOC duty managers, BU Ops managers, ramp leads; extend with Owner and Lead-stakeholder lenses for prototype governance. |
| Prototype storage | Browser local storage / IndexedDB. No backend persistence is required for this prototype. |
| Mutation rule | Simulator changes view state only. Baseline/source data must not be overwritten by simulation. |
| Primary experience | Modern Microsoft-inspired responsive dashboard with coordinated 2D/3D exploration, zoom, filtering, drill-down and role-based information density. |
| Out of scope | Autonomous execution, operational write-back, real airport-control actions, production identity/integration, and use cases 1, 3, 4, 5 except where their data entities are needed to visualize the control-tower picture. |

# 2. Product principles

* One operational picture: all views must derive from one in-browser prototype data model and one active filter/simulation context.
* Role relevance without fragmented truth: each role sees a tailored lens, but all lenses reference the same entity IDs, timestamps, status and ownership.
* View-first prototype: interactions may filter, group, highlight, compare or simulate; they must not mutate source operational records.
* Progressive disclosure: overview first, then pier/airline/flight/turnaround/task/asset detail without forcing users to leave the operational context.
* Human-comprehensible complexity: 2D and 3D must be linked representations of the same data, not separate experiences.
* Microsoft design principles: clarity, hierarchy, spacing, accessible color semantics, familiar command patterns, responsive surfaces and Fluent-style interaction behavior.

# 3. Users, roles and information lenses

| **Role / lens** | **Primary questions** | **Default visibility** |
| --- | --- | --- |
| Control Tower Lead / Lead stakeholder | Where is operational risk concentrating? What needs cross-BU escalation? Who owns each exception? | Airport-wide KPIs, exception severity, SLA exposure, action ownership, trend and hotspot views. |
| SIOC Duty Manager | Which flights/turnarounds need intervention now, and what is the latest operational state? | Live turnaround board, flight milestones, exception queue, dependency graph, assigned owners. |
| BU Ops Manager | What affects my business unit, people and service commitments? | BU-filtered workload, staff/capacity, tasks, flights, exceptions and SLA risk. |
| Ramp Lead | What is happening at my pier/stand and what needs action next? | Mobile-friendly pier/stand/flight view, milestones, tasks, GSE availability and high-priority exceptions. |
| Action Owner | What is assigned to me and what downstream outcomes depend on it? | Owned exceptions/tasks, due/target times, dependencies and status. |
| Observer / Executive | What is the operational picture without editing controls? | Read-only summary, trends, scenario comparison and 2D/3D situational view. |

# 4. Information architecture and dashboard

|  |  |
| --- | --- |
| **FR-001 Single operational data source [Must]** | |
| All dashboard components shall read from a shared client-side domain store keyed by stable entity IDs. | Acceptance: Changing a global filter updates every visible component consistently; no component shows an entity state that conflicts with another component. |

|  |  |
| --- | --- |
| **FR-002 Role-aware dashboard shell [Must]** | |
| The application shall provide role/lens selection for Control Tower Lead, SIOC Duty Manager, BU Ops Manager, Ramp Lead, Action Owner and Observer. | Acceptance: Switching role changes prioritization, layout emphasis and permitted prototype controls without changing underlying entity data. |

|  |  |
| --- | --- |
| **FR-003 Executive KPI strip [Must]** | |
| Show operational volume, flights at risk, active exceptions, SLA risk, delayed milestones, available/engaged GSE and open owner actions. | Acceptance: Each KPI supports drill-through to the exact entity set contributing to the KPI. |

|  |  |
| --- | --- |
| **FR-004 Live turnaround board [Must]** | |
| Provide a sortable/filterable flight and turnaround board with milestone status, risk, pier/stand, airline, owner and exception indicators. | Acceptance: A user can filter by BU, pier, airline, severity, owner and time window and open an entity detail panel. |

|  |  |
| --- | --- |
| **FR-005 Exception and ownership queue [Must]** | |
| Provide a prioritized queue of exceptions with severity, reason, source time, affected entities, owner, status and next expected action. | Acceptance: Every exception displayed has an owner state (named owner/role or explicitly Unassigned) and links to affected entities. |

|  |  |
| --- | --- |
| **FR-006 Coordinated drill-down [Must]** | |
| Selection in list, KPI, 2D view or 3D view shall update the shared selection context and synchronize all other views. | Acceptance: Selecting one flight highlights the same flight, turnaround, stand, tasks, assets and exceptions across all active panels. |

|  |  |
| --- | --- |
| **FR-007 Microsoft-inspired UI [Must]** | |
| Use a Fluent-inspired visual system with semantic colors, command bars, side panels, cards, tabs, accessible focus states, tooltips and responsive density. | Acceptance: Core workflows remain usable at desktop and tablet widths; status is not communicated by color alone. |

# 5. 2D / 3D situational understanding

|  |  |
| --- | --- |
| **VIZ-001 2D / 3D toggle [Must]** | |
| A persistent toggle shall switch between 2D operational map and 3D scene while preserving filters, selection, time position and simulation context. | Acceptance: Toggling views does not reset the selected flight/stand/exception or change any source record. |

|  |  |
| --- | --- |
| **VIZ-002 2D operational view [Must]** | |
| The 2D view shall support pan, zoom-in/out, fit-to-scope, layer toggles, clustering and semantic highlighting of stands, flights, GSE, tasks and exceptions. | Acceptance: At any zoom level, the user can identify selected entities and return to airport-wide scope with one command. |

|  |  |
| --- | --- |
| **VIZ-003 3D operational scene [Must]** | |
| The 3D view shall render spatially meaningful airport-operation entities and their status/risk overlays with controlled simplification at distance. | Acceptance: The same selected entities and status colors are recognizable in 2D and 3D and remain synchronized. |

|  |  |
| --- | --- |
| **VIZ-004 Dynamic camera [Must]** | |
| 3D shall support orbit, pan, dolly/zoom, reset, fit selected, focus stand, follow selected entity, and smooth transition between overview and detail. | Acceptance: Camera commands are reversible, preserve application state, and never modify operational data. |

|  |  |
| --- | --- |
| **VIZ-005 Complexity management [Must]** | |
| Users shall be able to toggle layers for flights, stands, turnaround milestones, tasks, staff/capacity aggregates, GSE/assets, SLA risk, weather/operational constraints and exception relationships. | Acceptance: Layer changes affect rendering only; hidden entities remain in the domain store and KPI calculations unless the user explicitly applies a data filter. |

|  |  |
| --- | --- |
| **VIZ-006 Dependency visualization [Must]** | |
| Provide a relationship/dependency overlay connecting flight-turnaround-task-asset-exception-owner relationships. | Acceptance: Selecting an exception reveals upstream and downstream related entities without duplicating records. |

# 6. Simulator: non-destructive what-if analysis

The simulator is an added prototype requirement. It is intentionally separated from the source business records. A scenario consists of parameter overrides plus calculated display impacts. Applying, resetting or comparing scenarios changes only the rendered view and derived indicators.

| **Scenario case** | **Valid prototype parameters** | **Validation / behavior** |
| --- | --- | --- |
| Late inbound | Flight occurrence; delay minutes 0-240; affected pier/stand; connection sensitivity Low/Med/High | Recompute displayed milestone timing, exception severity and SLA-risk indicators only. |
| Weather / ramp stoppage | Start offset; duration 0-180 min; affected zone(s); severity; recovery buffer | Overlay constraint window and derived impact; source flight/task records remain unchanged. |
| Missing / unavailable GSE | Asset type; quantity unavailable 0..available count; affected pier/stand; duration | Update simulated availability, dependent task risk and impacted turnarounds. |
| Staff capacity reduction | BU/team; capacity delta 0-100%; effective window; optional skill group | Update simulated capacity pressure and task/milestone risk. |
| SLA threshold stress | Airline; SLA milestone; threshold delta; selected flights/time window | Recalculate simulated SLA-risk categorization for view comparison. |
| Combined disruption | Any compatible combination of the above with scenario name and notes | Show conflict validation, scenario summary, impacted entity count and baseline-vs-scenario view. |

|  |  |
| --- | --- |
| **SIM-001 Scenario isolation [Must]** | |
| Every simulator run shall be stored as a scenario object separate from baseline entities. | Acceptance: Inspecting baseline data after scenario application shows byte-equivalent business entity values except prototype UI metadata. |

|  |  |
| --- | --- |
| **SIM-002 Parameter validation [Must]** | |
| Simulator controls shall enforce range, type, required scope and cross-parameter compatibility before a scenario is applied. | Acceptance: Invalid or contradictory parameters produce a visible validation message and do not alter the active view. |

|  |  |
| --- | --- |
| **SIM-003 Baseline comparison [Must]** | |
| Provide Baseline / Scenario / Difference modes. | Acceptance: Users can identify which metrics/entities differ and can return to Baseline with one action. |

|  |  |
| --- | --- |
| **SIM-004 Scenario lifecycle [Must]** | |
| Users may create, duplicate, rename, activate, deactivate and delete prototype scenarios from browser storage. | Acceptance: Deleting a scenario never deletes baseline operational entities. |

# 7. Business entity coverage

The source use case explicitly calls for flights, turnarounds, staff, equipment, SLA risk, exceptions, BU/pier/airline drill-down and actionable ownership. The prototype domain model below expands these into normalized UI entities so every control-tower concept has an addressable record.

| **Entity** | **Minimum fields** | **Key relationships** |
| --- | --- | --- |
| FlightOccurrence | id, flightNo, airlineId, origin/destination, STD/STA/ETD/ETA/ATA, status, pierId, standId | 1:1/1:n Turnaround; Airline; Stand; Exceptions |
| Turnaround | id, flightId, planned/actual window, phase, health, SLA risk | Flight; Milestones; Tasks; Assets; Exceptions |
| Milestone | id, turnaroundId, type, plannedTime, actual/forecastTime, status | Turnaround; Tasks; SLA |
| Task | id, turnaroundId, taskType, ownerId/role, status, planned/forecast/actual times, priority | Turnaround; Owner; Asset; Exception |
| StaffCapacity | id, BU/team, skillGroup, planned, available, engaged, window | BU; Tasks; Exceptions |
| Asset / GSE | id, type, status, location, assignment, availability window | Task; Turnaround; Stand; Exception |
| Stand / Pier | id, pier, stand, coordinates2D, coordinates3D, status | Flights; Turnarounds; Assets; Exceptions |
| Airline | id, code, name, SLA profile id | Flights; SLA Rules |
| SLARule | id, airlineId, milestone/task scope, target, tolerance, priority | Airline; Milestone; SLARisk |
| SLARisk | id, ruleId, affectedEntityId, level, cause, forecast breach time | SLA Rule; Flight/Turnaround/Task; Exception |
| Exception | id, type, severity, detectedAt, source, status, ownerId/role, affectedEntityIds, explanation | Any operational entity; Owner; Action |
| Action / Ownership | id, exceptionId/taskId, owner, leadStakeholder, status, targetTime, audit entries | Exception/Task; Role; Stakeholder |
| BusinessUnit | id, name, operational scope | Staff; Owners; Tasks; filters |
| Role / Stakeholder | id, displayName, roleType, BU, responsibility scope | Actions; Exceptions; dashboard lens |
| Weather / Constraint | id, type, scope, start/end, severity, source timestamp | Stand/Pier; Flight; Task; Simulation |
| Scenario | id, name, parameters, createdAt, active, derivedImpact | References baseline entities; never owns/mutates them |
| Audit / Interaction Event | id, time, actor/lens, action, entityRef, scenarioRef | Trace prototype user interactions and scenario changes |

# 8. Data and browser-storage design

|  |  |
| --- | --- |
| **DATA-001 Prototype seed data [Must]** | |
| The application shall load an attached-derived or synthetic prototype dataset that covers every domain entity and all supported risk states. | Acceptance: A fresh browser profile can initialize the prototype and display representative entities without external services. |

|  |  |
| --- | --- |
| **DATA-002 Browser persistence [Must]** | |
| Use IndexedDB for entity/scenario collections and localStorage only for small UI preferences such as selected role, theme, active view and panel layout. | Acceptance: Refresh/reopen restores prototype state; exceeding localStorage-style small-value limits does not break entity persistence. |

|  |  |
| --- | --- |
| **DATA-003 Read-only baseline records [Must]** | |
| Baseline entity stores shall expose immutable/read-only application objects to UI features. | Acceptance: Attempted simulator or visualization actions cannot edit baseline records. |

|  |  |
| --- | --- |
| **DATA-004 Schema versioning [Must]** | |
| Stored data shall contain schemaVersion and seedVersion with an explicit migration/reset pathway. | Acceptance: A schema mismatch is detected and handled without silent corruption. |

|  |  |
| --- | --- |
| **DATA-005 Reset and export [Must]** | |
| Provide Reset Prototype and Export Scenario/Diagnostics actions. | Acceptance: Reset restores the seed baseline; export excludes secrets and clearly separates baseline identifiers from scenario overrides. |

# 9. Detailed views and interactions

| **View** | **Required contents** |
| --- | --- |
| Operations overview | KPI strip, airport 2D/3D pane, exception priority list, risk-by-pier/airline, active scenario banner, ownership summary. |
| Turnaround workspace | Flight header, milestone timeline, tasks, assigned GSE, staff capacity indicators, SLA risks, related exceptions, owner trail. |
| Exception detail | Severity, detection time/source, impacted entities, dependency chain, owner/lead stakeholder, aging/target time, current and simulated impact. |
| Owner workbench | Items grouped by owner/role, cross-BU dependencies, due/target windows, status and impact. |
| Scenario manager | Scenario list, parameter editor, validation, apply/reset, baseline/scenario/difference comparison and impacted-entity explorer. |
| 3D focus mode | Selected pier/stand/flight context, layer controls, camera controls, labels/tags, risk legend and mini summary panel. |

# 10. Non-functional requirements

|  |  |
| --- | --- |
| **NFR-001 Performance [Must]** | |
| Common filters, selection changes and role switches should update interactively without full page reload; rendering shall use viewport/layer simplification for dense scenes. | Acceptance: Prototype test dataset remains usable during rapid pan/zoom, view toggle and filter interactions. |

|  |  |
| --- | --- |
| **NFR-002 Accessibility [Must]** | |
| Support keyboard navigation, visible focus, semantic labels, sufficient contrast, text alternatives for status, reduced-motion preference and non-color risk encoding. | Acceptance: Critical dashboard and simulator workflows are operable without mouse-only gestures. |

|  |  |
| --- | --- |
| **NFR-003 Responsive design [Must]** | |
| Support control-room desktop, standard laptop/tablet and compact ramp-lead layouts. | Acceptance: No primary action or critical status becomes inaccessible at supported breakpoints. |

|  |  |
| --- | --- |
| **NFR-004 Explainability [Must]** | |
| Every derived risk or simulated change shall show contributing factors/parameters and label whether it is Baseline or Simulated. | Acceptance: Users can distinguish observed/source values from prototype-derived calculations at all times. |

|  |  |
| --- | --- |
| **NFR-005 Safety boundary [Must]** | |
| The prototype shall contain no control that represents actual airport execution or data write-back. | Acceptance: All scenario actions are labeled simulation/view-only and no network mutation endpoint is required. |

|  |  |
| --- | --- |
| **NFR-006 Observability [Must]** | |
| Capture client-side diagnostics for load, render errors, invalid scenario parameters and interaction timings without sensitive operational payloads. | Acceptance: Diagnostics can be exported for prototype troubleshooting. |

# 11. State model

| **State family** | **Allowed states** |
| --- | --- |
| Flight | Scheduled, Inbound, Arrived, Turnaround, Ready, Departed, Delayed, Cancelled |
| Turnaround | NotStarted, Active, AtRisk, Blocked, Complete |
| Milestone / Task | Planned, Ready, InProgress, AtRisk, Blocked, Complete |
| Asset | Available, Reserved, Engaged, Unavailable, Unknown |
| Exception | New, Acknowledged, Assigned, Monitoring, Resolved |
| SLA risk | Normal, Watch, AtRisk, Breach |
| Scenario | Draft, Valid, Active, Inactive |

These prototype states are proposed engineering normalizations, not claims about existing SATS/Changi system enumerations. They should be mapped to actual source-system codes during production discovery.

# 12. Acceptance scenarios

| **ID** | **Given / When / Then** |
| --- | --- |
| AT-01 | Given the airport-wide overview, when a Lead stakeholder switches to Ramp Lead, then the same underlying records remain active while the view emphasizes the selected ramp scope and owned actions. |
| AT-02 | Given a flight selected in the turnaround board, when the user toggles 2D to 3D, then the same flight, stand, turnaround and related exceptions remain selected and visible. |
| AT-03 | Given a late-inbound simulator scenario of 45 minutes, when Apply is selected, then risk/milestone indicators update in Scenario mode and baseline entity timestamps remain unchanged. |
| AT-04 | Given an invalid stoppage duration or unavailable-asset quantity, when Apply is selected, then validation is shown and the active scenario/view is not changed. |
| AT-05 | Given multiple active exceptions, when filtering by Owner, then KPIs, list, map and 3D scene resolve to the same filtered entity set. |
| AT-06 | Given dense 3D content, when the user zooms from airport to stand level, then labels/layers progressively disclose detail and the dynamic camera can reset to overview. |
| AT-07 | Given a scenario is deleted, when Baseline is reopened, then all seeded baseline entities and values are intact. |

# 13. Prototype component architecture

* Web application shell: React/TypeScript recommended for the prototype UI; component library should follow Fluent-style patterns.
* Domain store: normalized in-memory state hydrated from IndexedDB; selectors produce role/filter/scenario-specific projections.
* Scenario engine: pure functions accepting baseline snapshot + validated parameters and returning derived impact overlays.
* 2D renderer: vector/canvas/WebGL map abstraction with layers and stable entity hit-testing.
* 3D renderer: WebGL scene abstraction with entity-to-scene mapping, level of detail, labels/tags and camera controller.
* Persistence: IndexedDB repositories for baseline seed cache, scenarios and diagnostic events; localStorage for lightweight preferences.
* No production service dependency: network adapters should be behind interfaces so future real-time sources can replace the seed provider without rewriting presentation logic.

# 14. Traceability to the attached business material

| **Business statement from source** | **Requirement coverage** |
| --- | --- |
| SIOC, BU Ops and Ground Ops each see part of the picture | FR-001, FR-002, FR-006, coordinated 2D/3D single data source. |
| Exceptions are spotted late and escalated by hand | FR-003, FR-005, exception details, ownership and risk visualization. |
| It is not always clear who should do what when plans change | Role/Stakeholder, Action/Ownership, owner workbench, exception queue. |
| Single pane of glass showing flights, turnarounds, staff, equipment and SLA risk | Entity model plus operations overview and turnaround workspace. |
| Drill-down by BU, pier and airline; mobile view for ramp leads | FR-004, role lenses, responsive NFR-003. |
| Priority exceptions tracked to closure in one flow | Exception/Action state, ownership queue and audit entity. |
| User-added requirement: simulator is view-only | SIM-001..004, DATA-003, NFR-005. |
| User-added requirement: 2D/3D with zoom and dynamic camera | VIZ-001..006. |

# 15. Production-discovery gaps / decisions

* Confirm the actual SATS/Changi source interfaces, source-system identifiers, event schemas and freshness/latency contracts.
* Confirm authoritative role/accountability matrix and named Control Tower Lead / owner assignments.
* Confirm the real airport spatial model permitted for 2D/3D use, coordinate system, map/3D asset rights and airside-security constraints.
* Confirm exact SLA definitions and airline-specific milestone rules; the source leaves some target values TBC.
* Confirm production identity, authorization, retention, audit and privacy requirements. Browser storage is for prototyping only.
* Confirm performance targets and representative peak entity volumes before committing to a production 3D rendering stack.

# 16. Definition of done for this prototype

* All entity types in Section 7 are populated and discoverable in the UI.
* All role lenses in Section 3 are demonstrable from a single data store.
* 2D and 3D views are synchronized and support selection, layer control and zoom; 3D supports dynamic camera controls.
* At least the five simulator cases in Section 6 validate parameters and produce non-destructive Baseline/Scenario/Difference views.
* Baseline records remain unchanged after any simulator sequence, page refresh and scenario deletion.
* Critical workflows satisfy accessibility and responsive requirements.
* Every displayed simulated/derived value is labeled explicitly and traceable to its parameters.

# 17. Resource and task optimization (autopilot)

The original sections had no optimization capability: the simulator only analyses what-if impact and the decision queue only suggests mitigations. This section adds a one-click optimizer that recommends a re-plan of airport resources. It is a recommendation engine only: it is view-only, never edits baseline records and never writes back to operations (DATA-003, NFR-005).

| **Priority / limitation** | **Used as** | **Prototype behavior** |
| --- | --- | --- |
| SLA / airline priority | Weight | Ranks flights by turnaround SLA risk, airline SLA tier and open exception severity. |
| Time criticality | Weight + hard limit | Soonest departures rank higher; planning horizon (rolling window) bounds the problem; aircraft already on stand are frozen. |
| Location distance | Weight + hard limit | Prefers stands close to the available equipment pool; assigns the nearest free GSE within a maximum travel distance. |
| Resource limitation | Weight + hard limit | One task at a time per GSE unit; moves crew from slack to overloaded skill pools; fewer stand moves (re-gating penalty). |
| Gate crew seats | Hard limit | At most N concurrent servicing tasks per stand; excess tasks are staggered. |
| Turnaround buffer / closures / weather | Hard limit | No stand overlap including buffer; closed stands and weather-constrained piers are avoided. |

|  |  |
| --- | --- |
| **OPT-001 One-click optimization [Must]** | |
| An Optimize tab shall provide a single "Optimize all" action that plans stands, GSE assignments, crew-pool transfers and crew-seat staggering together. | Acceptance: One click produces a plan without further input; running it twice on the same data yields the same plan. |

|  |  |
| --- | --- |
| **OPT-002 Configurable priorities and limits [Must]** | |
| Users shall choose a preset (Balanced, SLA first, Resource saving, Time critical) or adjust weights (0-10) for SLA, distance, time and resources, and set horizon, stand buffer, maximum GSE travel and crew seats per stand. | Acceptance: Changing weights or limits clears any stale plan; limits are never violated in the produced plan. |

|  |  |
| --- | --- |
| **OPT-003 Explainable result [Must]** | |
| The plan shall show before/after measures (stand overlaps, unassigned GSE tasks, GSE travel, overloaded crew pools, seat overruns, weighted cost), every individual change with its reason, and items it could not resolve. | Acceptance: Each move, assignment, transfer and shift is listed; unresolved items state the blocking limit and are left for a human decision. |

|  |  |
| --- | --- |
| **OPT-004 Non-destructive and auditable [Must]** | |
| The optimizer shall respect the active scenario view (simulated delays, closures, capacity), mark its output as derived, and write an audit entry per run. | Acceptance: Baseline entities are byte-equivalent after a run (AT-08). |

Optimization approach (practice-aligned): a priority-ordered greedy heuristic with a rolling horizon and frozen window, turnaround buffers between consecutive stand uses, GSE allocation as time-window scheduling with proximity, skill-pool levelling and crew-seat limits. Production would replace the heuristic with an exact or metaheuristic solver (MIP/CP-SAT) behind the same interface. Reference material: [A Complete Guide on Airport Operations Optimization](https://www.bqpsim.com/articles/airport-operations-optimization); [Optimizing Airport Gate Assignments: Methods & Metrics](https://www.bqpsim.com/quantum-optimization/airport-gate-optimization); [A Bi-Objective Optimization Model for Integrated Gate Assignment and ...](https://www.mdpi.com/2673-7590/6/2/86); [Improving Robustness through Buffer Placement in the Gate Assignment Problem](https://www.mit.edu/~hamsa/pubs/ZimmerBalakrishnanOdoni-ICRAT2024-final.pdf); [The Airport Gate Assignment Problem (Lim et al.)](https://www.researchgate.net/profile/Andrew-Lim-16/publication/2919193_The_Airport_Gate_Assignment_Problem/links/00b495298b538ba93a000000/The-Airport-Gate-Assignment-Problem.pdf).

| **ID** | **Given / When / Then** |
| --- | --- |
| AT-08 | Given the live baseline or any active scenario, when the user selects Optimize all, then a plan with before/after measures is shown, no limit is exceeded, unresolved items are flagged, and baseline entity values remain unchanged. |

# 18. Resource planning (day / week schedule)

|  |  |
| --- | --- |
| **PLAN-001 Day and week resource schedule [Must]** | |
| A Planning tab shall show what each resource (gates, staff teams and shifts, GSE units, baggage belts, check-in rows) is scheduled for in a selected day or the whole week, as a Gantt chart and as a table. | Acceptance: Switching Day/Week and Gantt/Table keeps the same filters; each row shows its capacity number, utilization and conflicts. |

|  |  |
| --- | --- |
| **PLAN-002 Filters, drill-down and conflicts [Must]** | |
| Users shall filter by resource type, terminal and free-text search, open any bar for its detail, and see overlapping bookings or over-capacity loads flagged. | Acceptance: A double-booked gate is highlighted in both views and counted in the conflict total. |

|  |  |
| --- | --- |
| **PLAN-003 Sample data when no roster feed exists [Should]** | |
| Without a real roster/AODB feed the prototype shall generate a deterministic sample week modelled on Changi (four terminals, about 100 gates, 3-shift SATS / dnata style ground handling, about 1,000 movements a day). | Acceptance: Data is labelled simulated and identical on every fresh profile. Sources: [Singapore Changi Airport (SIN) terminal map](https://worldairportmap.com/airport/SIN); [Infrastructure of Changi Airport](https://en.wikipedia.org/wiki/Infrastructure_of_Changi_Airport). |

# 19. Language switching

|  |  |
| --- | --- |
| **I18N-001 Four-language UI [Must]** | |
| A header toggle shall switch the whole UI between English, Chinese (Simplified), Korean and Japanese, including labels, tooltips, messages, tables, charts, 2D/3D labels and generated explanations (seed, demo, optimizer and planning text). | Acceptance: Switching language changes all visible text without losing selection, filters or scenario state; the choice persists across reloads; missing translations fall back to English. |

# 20. GPS tracking map

|  |  |
| --- | --- |
| **GPS-001 Entity tracking every 5 minutes [Must]** | |
| The Situational view shall offer a GPS mode that tracks aircraft (ADS-B / A-SMGCS), GSE vehicles (vehicle telematics) and staff (handheld GNSS, indoor BLE / Wi-Fi) with one position fix per entity every 5 operational minutes (latitude, longitude, level, speed, heading, accuracy, source, state). | Acceptance: New fixes appear every 5 minutes of operational time; each fix is stored in IndexedDB and exportable as CSV. |

|  |  |
| --- | --- |
| **GPS-002 Map layers [Must]** | |
| Users shall choose a map layer: Overview, Apron / airside, Level 1 arrivals, Level 2 departures or Level 3 transit / gates. Only entities on the chosen level are shown. A Go-to selector jumps to Terminal 1-4 or Jewel. The map layout follows the public Changi map (T3 north, T2 with two south piers, T1 east with angled piers, Jewel in the middle, T4 south-west) and gates are labelled like the public map (e.g. D30). | Acceptance: Switching layers changes the floor features (belts, check-in rows, gate lounges, stands) and the visible entities. |

|  |  |
| --- | --- |
| **GPS-003 Google-Maps-style navigation [Must]** | |
| The map shall support wheel / trackpad zoom around the cursor, drag to pan, pinch zoom, double-click zoom, +/- buttons, reset, zoom to selection, keyboard control, a scale bar and cursor coordinates, with labels revealed as the user zooms in. | Acceptance: Zoom keeps the point under the cursor fixed and is bounded between overview and stand level. |

|  |  |
| --- | --- |
| **GPS-004 History and replay [Should]** | |
| Users shall replay the last 3 hours of fixes with a time slider, see movement trails, search and follow an entity. | Acceptance: Replay shows each entity at its last fix at or before the chosen time; Live returns to the newest fix. |

The map geometry is a schematic of the public [Changi Airport map](https://www.changiairport.com/en/at-changi/map.html) (terminals T1-T4, Jewel, apron, runways), not a survey; production would load the official floor plans / GeoJSON and a real positioning feed.

# Appendix A - Source grounding

Primary reference: SATS Project SPEAR - Business Envisioning Output.pptx, especially slides 3, 4, 7, 8 and 15-17. Supporting architectural reference: SkyFlowAI\_Solution\_Envisioning\_EN.pptx, especially the read-only evidence, coordinated data model, authority, state, reliability and human-control concepts. Requirements not explicitly present in those sources, including browser-only persistence, detailed simulator parameter ranges, normalized prototype state enums, and 2D/3D camera behavior, are design proposals added to satisfy the requested prototype scope.