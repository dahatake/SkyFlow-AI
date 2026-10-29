# SATS Project SPEAR: AI Operations Control Tower presentation narrative

Two linked storylines that cover the full engagement (Business Envisioning, Solution Envisioning, Architecture Design Session (ADS) and Prototyping):

- **Story A, executive.** For the CEO, COO, Head of SIOC and BU heads. Business-benefit view.
- **Story B, CIO / CTO.** For IT leadership, enterprise architecture and security. Technical view.

Both stories end with **Why Microsoft**. They share the same spine, so the two audiences can attend one joint session or separate ones and still hear the same story.

> Status: draft for validation with SATS. All key results, dates and scores below are **proposals to confirm with SATS**, as they are in the source decks.

---

## 0. The shared spine

| Act | Engagement stage | Question it answers | Main artefact |
| --- | --- | --- | --- |
| 1 | Business Envisioning | *Why act, and where first?* | 5 use cases, BXT scoring, prioritisation matrix |
| 2 | Solution Envisioning | *What does good look like?* | Fabric "surround, not replace" target, storyboard, control tower levels |
| 3 | Architecture Design Session | *How is it built, and is it safe?* | Horizon 1 / Horizon 2 architecture, runtime flow, NFR answers, decisions |
| 4 | Prototyping | *Can we see it working?* | Browser-based control tower: 2D/3D, simulator, optimiser, planning |
| 5 | Next steps | *What do we decide today?* | MVP scope by 13 Nov, build starts 11 Jan 2027 |

**One-line story:** *SATS has to handle more flights with the same apron, a tighter workforce and higher customer expectations. One real-time view, plus exceptions sent straight to their owners, moves operations from reactive to proactive. We have already shown it working, and it builds on the systems SATS runs today.*

**Recurring anchor scenario, "Thunderstorm over the apron".** It comes from the solution envisioning storyboard. A lightning stoppage delays **12 arrivals**, which causes **4 gate conflicts**. Today, SIOC finds this through radios, WhatsApp and several screens. With the control tower, each conflict is flagged, ranked by SLA and connection time, and routed to its owner in Teams within minutes. Both stories return to this scenario.

---

## Story A: Executive narrative (business benefit)

**Audience:** COO (sponsor), Control Tower Lead / Head of SIOC, Customer Service Lead, BU Ops heads.
**Length:** 20–25 minutes plus a 10-minute demo.
**Tone:** outcomes, risk, people, speed to value. No product jargon until the Why Microsoft section.

### A1. Opening: "How do we improve on great?"

- SATS already runs world-class ground handling at Changi. Project SPEAR asks what has to be true for that to hold in 2028.
- SPEAR's guiding principles become our design principles: **evolutionary, not revolutionary**; **analytics-driven decisions**; **surround, not replace**.

> Say: "This is not about replacing what works. It is about giving your best people a better view and more time."

### A2. The pressure: five SPEAR problem statements

1. **Manpower**: volumes are growing faster than the workforce.
2. **Cost and time**: overtime, delays and SLA penalties during disruption.
3. **Stakeholder expectations**: airlines, CAG and passengers expect proactive updates.
4. **Throughput limits**: more flights through the same apron, bays and fleet.
5. **Experience risk**: an ageing workforce, with know-how held by a few experienced controllers.

**Cost of doing nothing:** disruption keeps cascading into delays and SLA misses, and scarce experienced staff become the bottleneck.

### A3. A day today: the thunderstorm, without a control tower

- SIOC, BU Ops and Ground Ops each see only part of the picture.
- DSM, DCT, G-Ops and Mosaic screens are watched side by side. Coordination runs over walkie-talkies, WhatsApp and phone calls.
- Exceptions are spotted late and escalated by hand, and when plans change it is not always clear who should act.

> Pause on the 12 delays and 4 gate conflicts. Ask: "How long does it take today before the right person knows, and acts?"

### A4. Business Envisioning: what we did together

- In a one-day Innovation Hub workshop with the COO, Control Tower Lead, Customer Service Lead, Fleet/Asset Lead and Data Lead, we built a **2028 cover story** and five business use cases.
- We scored each use case for **business** value, **experience** fit and **technical** feasibility (BXT, 1–5):

| Use case | Value | Feasibility | Quadrant |
| --- | --- | --- | --- |
| 1. Unified operational data foundation | 3.2 | 3.6 | Quick win |
| **2. AI operations control tower** | **4.2** | **4.1** | **Quick win, highest value** |
| 3. Disruption prediction and recovery | 4.0 | 2.9 | Invest |
| 4. Ops copilot and proactive airline updates | 3.6 | 3.8 | Quick win |
| 5. Connected GSE and assets | 2.8 | 3.4 | Test and learn |

**Message:** the control tower ranks highest on both value and feasibility. It is the place to start, and the data foundation behind it also unlocks use cases 3–5.

### A5. Solution Envisioning: the vision, "top floor to shop floor"

- **One live view** of flights, turnarounds, staff, equipment and SLA risk, at three levels:
  - Executive scorecard for the COO.
  - Board and exception queue for SIOC duty managers.
  - "My flights, my exceptions" for BU Ops and ramp leads, on mobile.
- **Exceptions go to people, not screens.** Each priority exception has a named owner and an action trail through to closure.
- **Surround, not replace.** GroundStar, G-Ops, Mosaic, DSM and iFleet remain the systems of record. The control tower reads from them, and later writes back to them.

### A6. The outcomes we commit to measure

These are proposed key results; SATS will confirm the baselines.

| Outcome | Proposed target |
| --- | --- |
| Exception detection-to-action | **< 5 minutes** (MVP exit criterion) |
| Exception acknowledged by its owner | **< 2 minutes** |
| Priority exceptions tracked to closure in one flow | **100%** |
| Status calls and messages between SIOC and BU Ops | **−40%** |
| SLA adherence for priority airlines | **+[x] pts** |
| Manual data consolidation for daily reports | **−50%** (use case 1) |

**Business value:**
- Fewer delays and SLA penalties.
- Less disruption-driven overtime.
- Scarce experienced staff used where they matter most.
- More throughput through the same infrastructure.
- Better airline experience.

### A7. The ADS in one slide: built in two safe steps

- **Horizon 1 (now):** a prototype that runs in a browser with realistic Changi-like data. There is no connection to live operations, so there is no operational risk.
- **Horizon 2 (MVP, from January 2027):** the same screens connected to live feeds for **one terminal, three feeds and five exception rules**, piloted with **one SIOC shift**.
- **Roadmap (proposed):**

| Period | Milestone |
| --- | --- |
| Nov–Dec 2026 | Design and prototype |
| Jan–Mar 2027 | MVP |
| Apr–Jun 2027 | All terminals, write-back and ops copilot |
| H2 2027 | Prediction and recovery options |

> Say: "Every step is reversible and earns the right to the next one."

### A8. Prototype demo: see the thunderstorm handled

Live demo, about 10 minutes (detailed script in [Section C](#c-demo-script-shared)):

1. **Role lenses.** Switch from Control Tower Lead to Ramp Lead. The same facts appear with a different focus.
2. **One picture, linked 2D/3D.** Select one delayed flight, and its stand, tasks, GSE and exceptions are highlighted everywhere.
3. **What-if.** Apply a 45-minute late inbound, then a weather stoppage. Compare baseline and scenario side by side, without changing any real data.
4. **One-click optimiser.** Re-plan stands, GSE and crew within SLA priorities and safety limits. Every change comes with its reason, and the system shows what it could *not* solve so a person can decide.
5. **Day and week planning.** Show gates, teams, GSE and belts with conflicts flagged.

**Message:** "This is no longer a slide. Your controllers can try it next week."

### A9. Risks we are managing for you

| Concern | How it is addressed |
| --- | --- |
| "AI will make decisions for us." | People approve every action. Recommendations are explainable and editable, and there is a manual fallback. |
| Alert fatigue | Release 1 has only five priority rules, ranked by SLA, with owners named by BU and role. |
| Workforce trust | Assets are tracked, not people. The design builds in the controllers' expertise. |
| Disruption to running operations | Read-only first. Write-back to GroundStar and G-Ops comes only in phase 2, after the pilot. |
| Data leaving Singapore | Data stays in-region, and residency is checked before phase 2. |

### A10. Why Microsoft: the business view

1. **We meet your people where they already work.**
   - Alerts and actions arrive in **Microsoft Teams** as cards that can be acknowledged, assigned and closed.
   - Dashboards sit inside **DSM through Power BI**.
   - This means little new software to learn and faster adoption across SIOC and ramp teams.
2. **One platform from quick win to AI.**
   - The data foundation that powers the control tower (Microsoft Fabric) also powers the ops copilot, disruption prediction and connected GSE.
   - SATS pays once for integration instead of rebuilding it for every initiative, which was the "risk of doing nothing" in use case 1.
3. **Faster time to value, with proof.**
   - We have taken SATS from workshop to scored use cases, architecture and a working prototype in weeks.
   - The MVP is scoped to one terminal and one shift, so value shows up in months, not years.
4. **AI you can trust.**
   - Human-in-the-loop design, Microsoft's Responsible AI practices, and enterprise security and compliance through Microsoft Entra ID and Microsoft Purview.
   - Data can stay in Azure's Singapore region.
5. **A partner for the whole journey.**
   - The Innovation Hub, the account team, a CSAM and Data & AI specialists, plus Microsoft's partner ecosystem for build and rollout.
   - Proven aviation patterns from SPEAR Playback #1: connected carts reduced allocation time by about 40%, and an airport stand-planning optimiser runs live at scale.
6. **Evolution, not a rip-and-replace bet.**
   - The Microsoft approach surrounds SATS's existing investments, so their value is protected while the new capability is added.

### A11. The ask

- **COO:** sponsor the MVP. With the Microsoft AE, agree the partner and statement of work **by 18 December**.
- **Control Tower Lead:** confirm MVP scope (terminal, feeds, five rules) and name owners **by 13 November**. This decision unlocks everything else.
- **Target:** MVP build starts **11 January 2027**, with a one-shift SIOC pilot.

> Close: "Let's make the thunderstorm a 5-minute event, not a 50-call event."

---

## Story B: CIO / CTO narrative (technical view)

**Audience:** CIO, CTO, Enterprise Architect, Head of Data (EDH / DataNexus), IT Security, Integration lead.
**Length:** 45–60 minutes including the architecture walkthrough and demo.
**Tone:** architecture, integration risk, security, operability, total cost of ownership and a clear path to production.

### B1. Opening: the architecture problem behind the business problem

- Operations data is spread across **GroundStar, G-Ops, Mosaic, DSM, iFleet, BRS and TOMS**, plus CAG and airline feeds.
- Integrations are point-to-point. EDH / DataNexus is still being established as the hub.
- Analog processes such as radio, WhatsApp and paper leave gaps in the data.
- **The technical cost of doing nothing:** every new AI or dashboard initiative rebuilds its own integrations. That is slower, costlier and inconsistent.

> Say: "The control tower is the first consumer of an operational data platform. Get the platform right and use cases 3–5 become much cheaper."

### B2. Business Envisioning, translated into technical scope

- The control tower (use case 2) scored **4.1 on feasibility**. Its technical viability (3.8) rests on Power BI skills already in place, an MVP that needs only 2–3 feeds, and a natural extension of DSM and Digital Control Tower concepts.
- New skills are needed for **Fabric Real-Time Intelligence and Activator**. We plan to enable these with a partner.
- Recommended sequencing:
  - Build **use case 1 (data foundation) and use case 2 (control tower MVP) together**.
  - Prototype **use case 4 (ops copilot)** in parallel.
  - Prepare **use case 3** once 12–24 months of disruption history has been extracted.
  - Pilot **use case 5** at one pier.

### B3. Solution Envisioning: target architecture, "surround, not replace"

Five layers, all governed centrally:

| Layer | Components |
| --- | --- |
| **Sources** | GroundStar (tasks, rosters); G-Ops, Mosaic and DSM; CAG turnaround events; iFleet and GSE tracking; BRS baggage; weather and airline SLAs |
| **Ingest** | Fabric **Eventstreams** for real-time feeds; **Data Factory and mirroring** for batch data; **OneLake shortcuts** to EDH with no copy |
| **Microsoft Fabric** | **Eventhouse (KQL)** for live events and the hot cache; **Lakehouse / OneLake** for history and reference data; an **ops model** (ontology plus semantic model) for flight, turnaround, task, asset; **Activator** for exception rules |
| **Experiences** | Control tower web app (same UI, Fabric adapter); **Power BI in DSM** with row-level security; **Real-Time Dashboard** with Maps layers; **Teams Adaptive Cards** with Power Automate; **Copilot Studio** agent over a Fabric data agent (phase 2) |
| **Governance** | **Microsoft Entra ID**; row-level security by BU and airline; **Microsoft Purview** lineage; capacity monitoring |

Key principle: **existing systems stay the systems of record.** Write-back is phase 2, and prediction plus the optimiser are phase 3.

### B4. ADS: one UI, two data horizons

- **Horizon 1, prototype (now).**
  - React + TypeScript single-page app with a Fluent-style UI.
  - IndexedDB seed data and no backend. localStorage is used only for small UI preferences.
  - View-only what-if simulator, and linked 2D/3D views.
- **The bridge: a data-provider interface.** The seed provider is swapped for a **Fabric adapter** with **no rewrite of the screens**. This is the most important architectural decision for de-risking the jump from prototype to production.
- **Horizon 2, production MVP (January 2027).**
  - Live feeds through Eventstreams.
  - An Eventhouse + OneLake ops model.
  - Activator rules that route exceptions to owners in Teams.

### B5. ADS: runtime flow for an exception

| Step | Stage | Service | What happens |
| --- | --- | --- | --- |
| 1 | Sense | Eventstreams | Flight, turnaround, task, GSE and weather events stream in |
| 2 | Detect | Fabric Activator | Rules flag deviations and SLA risk, ranked by priority |
| 3 | Route | Power Automate | An owner is assigned by BU and role |
| 4 | Notify | Teams Adaptive Card | A card goes to the owner in the BU channel |
| 5 | Act | Owner on mobile | Acknowledge, assign, close (write-back in phase 2) |
| 6 | Audit | OneLake | The outcome is logged to tune rules and models |

**Engineering targets:**
- Owner acknowledges an exception in **< 2 min**.
- Detection-to-action in **< 5 min** (MVP exit criterion).
- **5** priority exception rules in release 1.
- Event-to-dashboard latency **< 1 min** (use case 1 key result).

### B6. ADS: prototype component architecture

- **Shared view context** (role, filters, selection, time position, active scenario) drives every panel: role lenses, KPI strip, turnaround board, exception queue, owner workbench and scenario manager (FR-001, FR-006, VIZ-001).
- **Domain store:** normalised entities with a **read-only baseline**.
- **Scenario engine:** pure functions that take the baseline plus parameters and return a derived overlay. The baseline stays byte-equivalent after apply, refresh or delete (SIM-001, AT-07).
- **2D renderer:** layers, clustering and stable hit-testing.
- **3D renderer:** WebGL (Three.js) with level of detail and a camera controller.
- **Diagnostics:** load, render and timing data, with no operational payloads (NFR-006).
- **Persistence:** IndexedDB for seed cache, scenarios and diagnostics, with `schemaVersion` + `seedVersion` and a migration/reset path (DATA-004).
- **Optimiser (OPT-001…004):** a deterministic, priority-ordered greedy heuristic with a rolling horizon, frozen window, stand buffers, GSE proximity and crew-seat limits. It is explainable and non-destructive, and writes an audit entry per run. In production, an exact or metaheuristic solver (MIP / CP-SAT) on Azure would sit **behind the same interface**.

### B7. ADS: every non-functional requirement has an answer

| NFR | Design answer |
| --- | --- |
| NFR-001 Performance | Normalised store, memoised selectors, viewport and layer simplification, 3D level of detail. In production, follow Fabric Well-Architected guidance and isolate heavy workloads |
| NFR-002 Accessibility | Keyboard paths, visible focus, icon plus text for status, reduced-motion camera, Fluent design system |
| NFR-003 Responsive | Control-room, laptop/tablet and compact ramp layouts. Teams cards for ramp leads in production |
| NFR-004 Explainability | Every derived value is tagged Baseline or Simulated with its parameters, rule ID and cause |
| NFR-005 Safety boundary | Static hosting, no mutation endpoint, frozen baseline. Write-back only in phase 2 |
| NFR-006 Observability | Payload-free, exportable client diagnostics. Eventhouse metrics and logs in production |
| Security | Entra ID, row-level security by BU and airline, Purview lineage |
| **Data residency (check before phase 2)** | Answers from the Fabric data agent used in Copilot Studio may leave the Fabric compliance boundary or region. Validate this against the Singapore residency decision |

### B8. Prototyping: what is real today

- **Running code, not mock-ups.**
  - React 19 + TypeScript, Vite, Three.js and Fluent UI icons.
  - A Vitest test suite.
  - CI/CD in GitHub Actions.
- **Infrastructure as code.**
  - Bicep plus Azure Developer CLI (`azure.yaml`, `host: staticwebapp`).
  - Deployed to **Azure Static Web Apps**, with Microsoft Entra ID sign-in proposed.
- **Functional coverage.**
  - Six role lenses and a KPI strip with drill-through.
  - Turnaround board and exception/ownership queue.
  - Linked 2D map and 3D scene with dynamic camera.
  - Five-case what-if simulator (Baseline / Scenario / Difference).
  - One-click optimiser.
  - Day/week resource planning on a deterministic Changi-modelled sample week (four terminals, about 100 gates, about 1,000 movements a day).
- **Traceable.** Every screen maps to an FR, VIZ, SIM, DATA, NFR, OPT or PLAN requirement and to the business statements from envisioning ([requirement-definition.md](./requirement-definition.md), section 14).

> Say: "The prototype is also a working requirements specification. Its interfaces show exactly where Fabric plugs in."

### B9. Decisions to close in design sessions

| Session | Decisions |
| --- | --- |
| 1. Data and integration | Source interfaces and freshness; Eventhouse retention and capacity; SLA definitions per airline; spatial model and 3D asset rights |
| 2. Experience and alerting | DSM embedding and sign-in; write-back path to GroundStar and G-Ops; role and accountability matrix with named owners |
| 3. Security and operations | Access by BU and airline, and lineage; Singapore data residency; 24×7 support model |

Technical risks and how we mitigate them:

| Risk | Mitigation |
| --- | --- |
| Legacy interfaces (GroundStar, Mosaic) and data quality | Early sample access, data contracts per source, and EDH shortcuts before new pipelines |
| Latency of use case 1 feeds | Eventstreams into Eventhouse hot path, measured against the < 1 min target |
| CAG and airline data-sharing terms | Covered in design session 1, with sharing terms enforced through Purview |
| 24×7 uptime | Fabric capacity monitoring, defined support model, manual fallback |
| Model drift and solver run time (phase 3) | Model monitoring, human approval, solver kept behind the optimiser interface |

### B10. Why Microsoft: the technical view

1. **One unified, SaaS data platform instead of a tool chain.**
   - **Microsoft Fabric** puts real-time (Eventstreams, Eventhouse, Activator), batch (Data Factory), lake (OneLake), semantic model and BI in one governed platform, with one capacity and one security model.
   - **OneLake shortcuts and mirroring** extend EDH / DataNexus without copying or replacing it. This is "surround, not replace" applied at the data layer.
2. **Real-time to action, natively.**
   - **Activator** rules lead to **Power Automate** flows, which lead to **Teams Adaptive Cards**.
   - Detection-to-action is configuration rather than custom middleware, which shortens the path to the < 5-minute target.
3. **An AI roadmap on the same foundation.**
   - **Copilot Studio** and **Fabric data agents** support the ops copilot (use case 4).
   - **Azure AI Foundry**, **Azure Machine Learning** and Fabric Data Science support disruption prediction (use case 3).
   - **Azure IoT Hub / Event Hubs** and **Azure Maps** support connected GSE (use case 5).
   - All of these read the same OneLake ops model, so there are no new integrations per use case.
4. **Security, identity and governance by design.**
   - **Microsoft Entra ID** for single sign-on and conditional access.
   - Power BI / Fabric **row-level security** by BU and airline.
   - **Microsoft Purview** for lineage, labels and DLP.
   - An **Azure region in Singapore** for data residency.
   - Responsible AI tooling for monitoring and explainability.
5. **Open and portable engineering.**
   - Open formats (Delta/Parquet in OneLake), KQL and standard connectors for SQL, Kafka / Event Hubs, APIs and files.
   - Swappable solvers behind interfaces.
   - React/TypeScript front end, deployed with Bicep, `azd` and GitHub Actions.
   - This limits lock-in at the application layer, and SATS engineers can own the code.
6. **Low-friction adoption on the existing estate.**
   - Power BI skills and Microsoft 365 / Teams are already in place.
   - The control tower embeds in **DSM** and reaches frontline staff through Teams, so there is less new infrastructure to run.
7. **Partnership and delivery assurance.**
   - Innovation Hub architects, a CSAM, Data & AI specialists and a certified partner ecosystem.
   - A phased plan in which each horizon has explicit exit criteria.

### B11. The ask

| Owner | Ask | Date |
| --- | --- | --- |
| SATS Control Tower Lead | Confirm MVP scope (terminal, feeds, five rules) and name owners | 13 Nov |
| SATS Data Lead | Grant access to CAG, GroundStar and iFleet samples; confirm the EDH route | 20 Nov |
| SATS IT architecture and security | Join design sessions; decide residency, sign-in and DSM embedding | 4 and 11 Dec |
| SATS COO + Microsoft AE | Select partner and agree the MVP statement of work | 18 Dec |
| Partner + SATS SIOC | Start the MVP build and pilot with one SIOC shift | 11 Jan 2027 |

---

## C. Demo script (shared)

Use the same script for both audiences. For executives, narrate the outcomes. For the CIO/CTO, narrate the architecture notes.

| # | Action in prototype | Executive narration | CIO / CTO narration |
| --- | --- | --- | --- |
| 1 | Open the operations overview as **Control Tower Lead** | "One picture of the whole airport." | One domain store, with every panel bound to the shared view context |
| 2 | Switch the lens to **Ramp Lead** | "Same facts, my focus." | Role changes projection and emphasis, not data (FR-002, AT-01) |
| 3 | Select a delayed flight, then toggle **2D ↔ 3D** | "Everything about this flight, everywhere." | Selection, filters and time position preserved (VIZ-001, AT-02) |
| 4 | Simulator: **late inbound, 45 min**, then **weather stoppage** | "We see the knock-on effect before it happens." | Pure-function overlay; baseline byte-equivalent (SIM-001, AT-03) |
| 5 | Enter an invalid duration | "It won't let you make a mistake." | Validation blocks apply; view unchanged (SIM-002, AT-04) |
| 6 | **Optimize all** with the *SLA first* preset | "A recommended recovery plan in one click, with reasons." | Deterministic heuristic, hard limits respected, solver swappable (OPT-001…004, AT-08) |
| 7 | Open **Planning**, week view | "Tomorrow's and next week's pressure points." | Gantt and table over the same model; conflicts flagged (PLAN-001/002) |
| 8 | Show the architecture slide (Horizon 2) | "Next: live data, Teams alerts, one SIOC shift." | Data-provider interface: seed provider → Fabric adapter |

---

## D. Objection handling

| Objection | Executive response | CIO / CTO response |
| --- | --- | --- |
| "We already have DSM and a Digital Control Tower concept." | This improves DSM and is embedded in it. | Power BI in DSM, with RLS, on Fabric. It extends existing concepts and does not compete with them. |
| "Another platform to run?" | One platform replaces many point solutions over time. | Fabric is SaaS with one capacity, and EDH is surrounded via shortcuts, not migrated. |
| "Can we trust AI recommendations?" | People approve, and every recommendation shows its reasons. | NFR-004 explainability, audit entry per run, unresolved items left for a human. |
| "Data residency?" | Data stays in Singapore. | Azure Singapore region; the Copilot Studio / data agent boundary is validated before phase 2. |
| "What if GroundStar integration is hard?" | The MVP doesn't depend on write-back. | Read-only MVP; write-back designed in session 2 and delivered in phase 2. |
| "Vendor lock-in?" | SATS owns the app and the data. | Open formats, KQL and SQL, a React app in SATS's repo, solver behind an interface. |

---

## E. Source traceability and assumptions

| Narrative element | Source |
| --- | --- |
| Problem statements, principles, 5 use cases, BXT scores, sequencing, next steps | *SATS Project SPEAR – Business Envisioning Output.pptx*, slides 2–17 and notes |
| Fabric target architecture, runtime flow, storyboard, targets, MVP scope | *SATS Project SPEAR – Solution Envisioning Output – AI Operations Control Tower.pptx*, as cited in the ADS deck (slides 3, 11, 14–18) |
| Horizon 1 / 2, component architecture, NFR answers, decisions and owners | *AI Operations Control Tower – Architecture Diagrams and Next Steps.pptx* |
| Prototype scope, requirement IDs, acceptance tests, optimiser, planning | [requirement-definition.md](./requirement-definition.md) and the `app/` prototype |

**Assumptions:**
- The Solution Envisioning deck is rights-protected (IRM) and could not be read directly. Its content is represented here through the references to it in the ADS deck and the requirements definition. Validate the figures against the original deck before presenting.
- Key results marked `[x]` and all dates are proposals to confirm with SATS.
- Azure Static Web Apps hosting with Entra ID sign-in is a design proposal.
- Fabric ontology and digital twin builder capabilities were in preview at the time of the ADS. Check their status before committing to them in phase 2.
