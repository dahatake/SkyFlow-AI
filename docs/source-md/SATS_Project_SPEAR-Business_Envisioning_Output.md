<!-- Slide number: 1 -->

![Airport apron at dusk with baggage tractors, a wide-body aircraft and an approaching tropical storm](Picture8577.jpg)

![SATS logo](Picture8578.jpg)
INNOVATION HUB  ·  BUSINESS ENVISIONING

SATS
Project SPEAR
AI-powered operations control tower
Use cases, prioritisation and next steps
Singapore  ·  [Workshop date]
Draft output for validation with SATS stakeholders

<!-- Slide number: 2 -->
Workshop agenda and participants

![Illustrative ground-operations control centre with live apron map and storm radar](Picture11232.jpg)
09:00

Welcome, objectives and ways of working

09:20

Recap of SPEAR Playback #1: problems and principles

10:00

Cover-story exercise: SATS operations in 2028

11:00

Develop five business use cases

12:30

Lunch

13:15

Value and feasibility scoring (BXT)

Who took part

SATS
COO · Control Tower Lead (SIOC) · Customer Service Lead · Fleet / Asset Lead · Data Lead

MICROSOFT
Innovation Hub Technical Architect · Account Executive · CSAM · Data & AI specialist

14:30

Prioritisation matrix

15:15

Parking lot, next steps, owners and dates

15:45

Close

Proposed agenda and roles — update with actual timings and attendee names

<!-- Slide number: 3 -->
Why SATS needs an operations control tower

PROJECT SPEAR PROBLEM STATEMENTS

Ageing workforce, yet reliant on experience
Know-how sits with a few experienced controllers
01

GUIDING PRINCIPLES

How to improve upon “Great”?

•  Evolutionary, not revolutionary
•  Analytics-driven operations and decision making
•  Surround, not replace

Insufficient manpower to meet future demand
Volumes grow faster than the workforce
02

Cost and time pressures
Overtime, delays and SLA penalties during disruption
03

Throughput with infrastructure constraints
More flights through the same apron, bays and fleet
04

WORKSHOP MISSION

Shape an engagement around an AI-powered operations control tower: one real-time view of demand, capacity, assets, exceptions and customer impact — moving decisions from manual and reactive to predictive and proactive.

Meeting stakeholders’ expectations
Airlines, CAG and passengers expect proactive updates
05

Source: SATS Project SPEAR — Future of Ground Handling, Playback #1

<!-- Slide number: 4 -->
Five use cases answer SPEAR’s questions

| Use case | SPEAR question it answers | Lead stakeholder | Microsoft solution theme |
| --- | --- | --- | --- |
| 1. Unified operational data foundation | How to get better at sensing — all systems write to and read from EDH | Data Lead | Fabric operational data platform |
| 2. AI operations control tower | How to improve communication and transparency between SIOC, BU Ops and Ground Ops | Control Tower Lead | Power BI control tower + Teams workflow |
| 3. Disruption prediction and recovery optimiser | How to better react to emergent events, e.g. flight delays and inclement weather | COO | Azure AI disruption prediction |
| 4. Operations copilot and proactive customer updates | How to report better, faster, easier — templated, auto-summary | Customer Service Lead | Copilot Studio operations assistant |
| 5. Connected GSE and asset utilisation | How to get better at sensing — IIoT and asset tracking | Fleet / Asset Lead | Fabric Real-Time Intelligence + Azure IoT |

![Airport apron with ground support equipment and an approaching storm](Picture11590.jpg)
SPEAR questions from “Reframing the problem statements”, SATS Project SPEAR Playback #1

<!-- Slide number: 5 -->
1
# Unified operational data foundation
General

Problem to solve / opportunity to realise

THE CHALLENGE
•  Ops data is spread across GroundStar, G-Ops, Mosaic, DSM, iFleet, BRS and TOMS, plus CAG and airline feeds
•  No single, real-time view of demand, capacity, assets and exceptions across SIOC, BU Ops and Ground Ops
•  Analog processes (radio, WhatsApp, paper) leave gaps in the data

HOW IT IS SOLVED TODAY
•  Point-to-point interfaces; EDH / DataNexus being established as the hub
•  Duty managers consolidate data manually for decisions and reports

RISK OF DOING NOTHING
•  Every new AI or dashboard initiative rebuilds its own integrations — slower, costlier and inconsistent
What is your idea?

USE CASE DESCRIPTION
Extend EDH / DataNexus with Microsoft Fabric as the real-time operational data platform: every system writes to and reads from one governed OneLake, with streaming events for flights, tasks, assets and weather.

HOW IT WORKS
•  Eventstreams ingest flight, turnaround, task, GSE and weather events in seconds
•  One common data model: flight – turnaround – task – asset
•  Shortcuts and mirroring to existing EDH stores — no rip-and-replace
•  Governance, lineage and access by BU with Microsoft Purview

MICROSOFT SOLUTION COMPONENTS
Microsoft Fabric (Real-Time Intelligence, OneLake, Data Factory), Microsoft Purview

DATA AND SYSTEMS
GroundStar, G-Ops, Mosaic, DSM, iFleet, BRS, TOMS, CAG turnaround events, airline CPM, weather service

<!-- Slide number: 6 -->
1
# Unified operational data foundation
Value
Feasibility

Business objective
Create one trusted, real-time source of operational truth so every control-tower view, prediction and report uses the same data — delivering the SPEAR principle that all systems write to and read from EDH.
Technology fit
•  Common pattern for real-time operations hubs; reference stories to share at solution envisioning
•  Natural extension of EDH / DataNexus through shortcuts and mirroring
•  Standard connectors for SQL, Kafka / Event Hubs, APIs and files; GroundStar and Mosaic interfaces need review
•  Sourcing: Microsoft Fabric + Purview, with a data engineering partner

Key results (proposed — baseline to confirm)
•  ≥ 90% of priority data sources streaming to one platform
•  Event-to-dashboard latency under 1 minute
•  Manual data consolidation for daily reports down 50%
•  One governed data model for SIOC, BU Ops and Ground Ops

Strategic alignment
SPEAR: EDH as the only read/write layer; analytics-driven ops
Business value
Lower integration and reporting cost; de-risks every other use case (2–5)
Change resistance
Medium — system owners must agree shared data contracts and ownership
Change timeframe
     1–3 months
✓  4–6 months (estimate)
     > 6 months

Key personas
Data Lead, SIOC analysts, BU data owners, IT integration team
Value proposition appeal
High for data and IT teams (one platform); indirect for frontline users
Implementation risks
Legacy interfaces and data quality; CAG / airline data-sharing terms; peak volumes
Safeguards available?
Purview lineage, role-based access, in-region data, sharing terms

Primary stakeholder accountable for OKRs
Data Lead — [name TBC] · SATS Digital / Enterprise Data Hub
STRATEGIC FIT (BXT, 1–5)
Value 3.2  ·  Feasibility 3.6  ·  Quick win

### Notes:
Use case 1: Unified operational data foundation. Proposed BXT scores from the Microsoft team based on SATS Project SPEAR Playback #1 — validate with SATS stakeholders.
Business viability (value) 3.4 = average of revenue 2, efficiency 4, cost reduction 4, competitive advantage 4, time to value 3.
Experience viability 3.5 = user-need fit 4, clear audience 4, motivation vs alternatives 3, low adoption pain 3.
Technical viability 3.8 = skills available 3, integration ease 3, natural extension 5, accuracy / data assurance 4.
Feasibility = average of experience and technical viability = 3.6. Quadrant: Quick win.
Key results marked [x] or [baseline] need SATS figures — use the golden questions: how do you measure it, what is it now, what do you want it to be, what is the value of the difference, and over time?

<!-- Slide number: 7 -->
2
# AI operations control tower
General

Problem to solve / opportunity to realise

THE CHALLENGE
•  SIOC, BU Ops and Ground Ops each see part of the picture; coordination runs on walkies, WhatsApp and phones
•  Exceptions — late inbound, weather stoppage, missing GSE — are spotted late and escalated by hand
•  It is not always clear who should do what when plans change

HOW IT IS SOLVED TODAY
•  DSM, DCT, G-Ops and Mosaic screens watched side by side
•  Experience-based judgement by duty managers; manual status reports

RISK OF DOING NOTHING
•  Disruption continues to cascade into delays and SLA misses while scarce, experienced staff become the bottleneck
What is your idea?

USE CASE DESCRIPTION
Enhance DSM into a single pane of glass “from top floor to shop floor”: a live Power BI control tower on Fabric Real-Time Intelligence showing flights, turnarounds, staff, equipment and SLA risk — with exceptions pushed as actionable Teams alerts.

HOW IT WORKS
•  Live turnaround board with milestone status and SLA risk by flight
•  Activator rules raise exceptions, e.g. late inbound with a short connection
•  Adaptive Cards in Teams to acknowledge, assign and close actions
•  Drill-down by BU, pier and airline; mobile view for ramp leads

MICROSOFT SOLUTION COMPONENTS
Power BI, Fabric Real-Time Intelligence (Real-Time Dashboards, Activator), Microsoft Teams, Power Automate

DATA AND SYSTEMS
Use case 1 platform: CAG turnaround events, flight schedules, GroundStar deployment, iFleet, airline SLAs

<!-- Slide number: 8 -->
2
# AI operations control tower
Value
Feasibility

Business objective
Give every level of operations one real-time view of demand, capacity, assets, exceptions and customer impact, so issues are detected and acted on before they hurt on-time performance and SLAs.
Technology fit
•  Evolutionary: builds on existing DSM and Digital Control Tower concepts — surrounds Mosaic, does not replace it
•  MVP possible on 2–3 feeds (flights, tasks, GSE) once use case 1 streams them
•  Power BI skills usually in place; Real-Time Intelligence and Activator are new skills
•  Sourcing: Power BI + Fabric RTI + Teams; partner for UX and rollout

Key results (proposed — baseline to confirm)
•  Exception detection-to-action under 5 min (baseline TBC)
•  100% of priority exceptions tracked to closure in one flow
•  Status calls and messages between SIOC and BU Ops down 40%
•  SLA adherence for priority airlines up [x] pts

Strategic alignment
SPEAR: DSM as single pane of glass; transparency across SIOC, BU Ops and Ground Ops
Business value
Fewer delays and SLA penalties; better use of scarce staff
Change resistance
Low–medium — strong SIOC pull; ramp teams need mobile alerts and clear ownership
Change timeframe
     1–3 months
✓  4–6 months (estimate)
     > 6 months

Key personas
Control Tower Lead, SIOC duty managers, BU Ops managers, ramp leads
Value proposition appeal
High — one view and one action trail replace swivel-chair screens and chats
Implementation risks
Depends on use case 1 latency; alert fatigue; 24×7 uptime
Safeguards available?
Role-based views by BU and airline; action audit trail

Primary stakeholder accountable for OKRs
Control Tower Lead (Head of SIOC) — [name TBC] · SIOC
STRATEGIC FIT (BXT, 1–5)
Value 4.2  ·  Feasibility 4.1  ·  Quick win

### Notes:
Use case 2: AI operations control tower. Proposed BXT scores from the Microsoft team based on SATS Project SPEAR Playback #1 — validate with SATS stakeholders.
Business viability (value) 4.2 = average of revenue 3, efficiency 5, cost reduction 4, competitive advantage 5, time to value 4.
Experience viability 4.5 = user-need fit 5, clear audience 5, motivation vs alternatives 4, low adoption pain 4.
Technical viability 3.8 = skills available 4, integration ease 3, natural extension 4, accuracy / data assurance 4.
Feasibility = average of experience and technical viability = 4.1. Quadrant: Quick win.
Key results marked [x] or [baseline] need SATS figures — use the golden questions: how do you measure it, what is it now, what do you want it to be, what is the value of the difference, and over time?

<!-- Slide number: 9 -->
3
# Disruption prediction and recovery optimiser
General

Problem to solve / opportunity to realise

THE CHALLENGE
•  Flight delays, thunderstorm and lightning stoppages and late inbounds cascade across shifts
•  Re-planning for changes inside 2 hours is manual and relies on a few experienced staff — an ageing workforce
•  Staff and GSE are redeployed after the disruption hits, not before

HOW IT IS SOLVED TODAY
•  Duty managers adjust GroundStar deployment and SIOC priorities by phone and radio
•  Little use of predictive signals such as weather or inbound delay probability

RISK OF DOING NOTHING
•  Overtime, delays and SLA penalties grow as volumes rise and expert knowledge retires
What is your idea?

USE CASE DESCRIPTION
Predict disruption hours ahead and recommend recovery: Azure AI scores delay and weather-stoppage risk per flight; an optimiser proposes staff, task and GSE re-allocation for changes inside 2 hours; people approve — surround, not replace.

HOW IT WORKS
•  Delay-risk model on flight history, weather at origin and destination, and CAG milestones
•  Weather-stoppage nowcast (lightning, heavy rain) for ramp work
•  Constraint optimiser re-allocates staff, tasks and GSE
•  What-if scenarios in the control tower; approval through Teams

MICROSOFT SOLUTION COMPONENTS
Azure Machine Learning, Azure AI Foundry, Fabric Data Science, optimisation solver on Azure

DATA AND SYSTEMS
Use case 1 platform: 12–24 months of flights, delays, weather, tasks and stoppages; GroundStar RT

<!-- Slide number: 10 -->
3
# Disruption prediction and recovery optimiser
Value
Feasibility

Business objective
Move from reactive to predictive operations: anticipate disruption and re-plan resources before it hits, protecting on-time performance, SLAs and overtime cost.
Technology fit
•  Proven patterns in the SPEAR playback: flight-delay prediction on Azure and an airport stand-planning optimiser
•  Needs clean history across flights, weather, tasks and stoppages (use case 1)
•  Write-back to GroundStar RT for execution must be designed
•  Sourcing: Azure ML + solver; data science partner

Key results (proposed — baseline to confirm)
•  High-risk flights flagged ≥ 2 h ahead at agreed precision
•  Re-plan time for sub-2-h changes: [baseline] → minutes
•  Disruption-driven overtime down [x]%
•  On-time performance in disrupted periods up [x] pts

Strategic alignment
SPEAR: real-time optimiser for <2-hr changes; react better to emergent events
Business value
Lower overtime and penalty cost; more throughput within infrastructure limits
Change resistance
Medium–high — trust in AI advice; controller expertise must be built in
Change timeframe
     1–3 months
     4–6 months
✓  > 6 months (estimate)

Key personas
COO, SIOC duty managers, BU deployment controllers
Value proposition appeal
High if recommendations are explainable and editable; low if a black box
Implementation risks
Data-history gaps; model drift in rare events; solver run time
Safeguards available?
Human approval, explainable AI, model monitoring, manual fallback

Primary stakeholder accountable for OKRs
COO — [name TBC] · Operations (SIOC and BU Ops)
STRATEGIC FIT (BXT, 1–5)
Value 4.0  ·  Feasibility 2.9  ·  Invest

### Notes:
Use case 3: Disruption prediction and recovery optimiser. Proposed BXT scores from the Microsoft team based on SATS Project SPEAR Playback #1 — validate with SATS stakeholders.
Business viability (value) 4.0 = average of revenue 3, efficiency 5, cost reduction 5, competitive advantage 5, time to value 2.
Experience viability 3.5 = user-need fit 5, clear audience 4, motivation vs alternatives 3, low adoption pain 2.
Technical viability 2.3 = skills available 2, integration ease 2, natural extension 3, accuracy / data assurance 2.
Feasibility = average of experience and technical viability = 2.9. Quadrant: Invest.
Key results marked [x] or [baseline] need SATS figures — use the golden questions: how do you measure it, what is it now, what do you want it to be, what is the value of the difference, and over time?

<!-- Slide number: 11 -->
4
# Operations copilot and proactive customer updates
General

Problem to solve / opportunity to realise

THE CHALLENGE
•  Staff search SOPs, rosters and system screens under time pressure
•  Shift handovers and incident reports are written by hand — reporting should be better, faster, easier
•  Airline customers often hear about impact late; updates are ad-hoc calls and emails

HOW IT IS SOLVED TODAY
•  Calls and messages to SIOC for answers
•  Manual templates for reports and airline notifications

RISK OF DOING NOTHING
•  Knowledge stays in people’s heads as the workforce ages; customer experience depends on who is on shift
What is your idea?

USE CASE DESCRIPTION
An operations assistant in Teams, built with Copilot Studio, that answers questions over live ops data and SOPs, guides irregular-ops procedures, auto-summarises shifts and incidents, and drafts SLA-aware updates to airlines for human approval.

HOW IT WORKS
•  Ask: “Which flights at T3 are at risk of missing SLA in the next hour?”
•  Step-by-step SOP guidance for irregular operations, e.g. lightning stoppage
•  Auto-generated shift handover and incident reports
•  Drafted airline notifications, approved and sent from Teams

MICROSOFT SOLUTION COMPONENTS
Copilot Studio, Microsoft 365 Copilot, Microsoft Teams, Power Automate, Azure AI Search, Fabric data agents

DATA AND SYSTEMS
Use case 1 platform, SOP library, airline SLA terms, GroundStar rosters, incident logs

<!-- Slide number: 12 -->
4
# Operations copilot and proactive customer updates
Value
Feasibility

Business objective
Give every operator an assistant that finds answers, guides SOP execution and keeps airline customers informed proactively — reducing reliance on individual experience.
Technology fit
•  Copilot Studio and Teams allow a working prototype in weeks
•  Grounded on SOPs and live ops data through standard connectors
•  Natural extension of the “custom copilot” already proposed for DSM
•  Sourcing: Copilot Studio + Microsoft 365 Copilot; low-code by SATS team with partner support

Key results (proposed — baseline to confirm)
•  Shift handover and report preparation time down 50%
•  Airline notified within [x] min of a predicted SLA breach
•  ≥ 70% of SOP questions answered without escalation
•  Airline satisfaction score up [x] pts

Strategic alignment
SPEAR: report better, faster, easier; custom copilot in DSM
Business value
Productivity of scarce staff; knowledge capture; better airline experience
Change resistance
Low–medium — easy to adopt; frontline device access and trust to address
Change timeframe
✓  1–3 months (estimate)
     4–6 months
     > 6 months

Key personas
Customer Service Lead, airline account managers, SIOC, team leads
Value proposition appeal
High — natural-language answers inside Teams, where work already happens
Implementation risks
Answer accuracy on SOPs; frontline device and licence coverage; content quality
Safeguards available?
Cited answers; human approval before sends; DLP and labels

Primary stakeholder accountable for OKRs
Customer Service Lead — [name TBC] · Customer Service / SIOC
STRATEGIC FIT (BXT, 1–5)
Value 3.6  ·  Feasibility 3.8  ·  Quick win

### Notes:
Use case 4: Operations copilot and proactive customer updates. Proposed BXT scores from the Microsoft team based on SATS Project SPEAR Playback #1 — validate with SATS stakeholders.
Business viability (value) 3.6 = average of revenue 3, efficiency 4, cost reduction 3, competitive advantage 3, time to value 5.
Experience viability 3.8 = user-need fit 4, clear audience 4, motivation vs alternatives 4, low adoption pain 3.
Technical viability 3.8 = skills available 4, integration ease 4, natural extension 4, accuracy / data assurance 3.
Feasibility = average of experience and technical viability = 3.8. Quadrant: Quick win.
Key results marked [x] or [baseline] need SATS figures — use the golden questions: how do you measure it, what is it now, what do you want it to be, what is the value of the difference, and over time?

<!-- Slide number: 13 -->
5
# Connected GSE and asset utilisation
General

Problem to solve / opportunity to realise

THE CHALLENGE
•  Carts, dollies and GSE are pre-allocated on planning sheets; late arrivals lock assets that then sit idle
•  Equipment is hard to locate, so staff search the apron
•  Adding assets is costly and constrained by apron space

HOW IT IS SOLVED TODAY
•  iFleet for motorised GSE; non-motorised equipment tracking being introduced
•  Allocation by planning sheet, radio and experience

RISK OF DOING NOTHING
•  Fleet grows faster than throughput, adding capex and depreciation
What is your idea?

USE CASE DESCRIPTION
Track every GSE unit and cart in real time and allocate dynamically: IoT location and status stream into Fabric, AI recommends allocations against live ETAs, and towing instructions go to mobile devices — from planned to real-time asset operations.

HOW IT WORKS
•  IoT trackers stream location and status: available, waiting, engaged
•  Live asset map by pier in the control tower
•  Allocation recommendations driven by ETA / ATA and turnaround needs
•  Predictive maintenance signals from usage and telemetry

MICROSOFT SOLUTION COMPONENTS
Azure IoT Hub / Event Hubs, Fabric Real-Time Intelligence, Azure Maps, Azure Machine Learning, Power Apps

DATA AND SYSTEMS
iFleet, non-motorised equipment tracking, flight ETA / ATA, turnaround plans, maintenance records

<!-- Slide number: 14 -->
5
# Connected GSE and asset utilisation
Value
Feasibility

Business objective
Raise asset utilisation and cut idle and search time, so SATS grows throughput without growing the fleet at the same rate.
Technology fit
•  Reference in the SPEAR playback: connected carts cut allocation time from 1:15h to 0:45h (40%)
•  Extends iFleet and the non-motorised equipment tracking already planned
•  Tracker hardware and airside connectivity need to be selected
•  Sourcing: Azure IoT + Fabric; IoT hardware partner

Key results (proposed — baseline to confirm)
•  Cart allocation time per turnaround down up to 40%
•  GSE utilisation up [x] pts; idle time down [x]%
•  Time spent searching for equipment down [x]%
•  [x]% of planned cart and GSE purchases deferred

Strategic alignment
SPEAR: better sensing (IIoT); throughput within infrastructure constraints
Business value
Capex avoidance, lower depreciation, fewer delays from missing equipment
Change resistance
Medium — new mobile workflows; workforce concerns about tracking
Change timeframe
     1–3 months
✓  4–6 months (estimate)
     > 6 months

Key personas
Fleet / Asset Lead, ramp and baggage leads, tractor drivers
Value proposition appeal
Medium–high — less searching; drivers must follow mobile instructions
Implementation risks
Tracker durability airside; location accuracy; iFleet link
Safeguards available?
Track assets, not people; device airside approval; secure device identity

Primary stakeholder accountable for OKRs
Fleet / Asset Lead — [name TBC] · Ground Ops — GSE fleet
STRATEGIC FIT (BXT, 1–5)
Value 2.8  ·  Feasibility 3.4  ·  Test and learn

### Notes:
Use case 5: Connected GSE and asset utilisation. Proposed BXT scores from the Microsoft team based on SATS Project SPEAR Playback #1 — validate with SATS stakeholders.
Business viability (value) 2.8 = average of revenue 2, efficiency 3, cost reduction 3, competitive advantage 3, time to value 3.
Experience viability 3.5 = user-need fit 3, clear audience 4, motivation vs alternatives 4, low adoption pain 3.
Technical viability 3.3 = skills available 3, integration ease 3, natural extension 4, accuracy / data assurance 3.
Feasibility = average of experience and technical viability = 3.4. Quadrant: Test and learn.
Key results marked [x] or [baseline] need SATS figures — use the golden questions: how do you measure it, what is it now, what do you want it to be, what is the value of the difference, and over time?

<!-- Slide number: 15 -->
How the use cases score on value and feasibility

| Use case | Value (business) | Experience | Technical | Feasibility | Quadrant |
| --- | --- | --- | --- | --- | --- |
| 1. Operational data foundation | 3.2 | 3.5 | 3.8 | 3.6 | Quick win |
| 2. AI operations control tower | 4.2 | 4.5 | 3.8 | 4.1 | Quick win |
| 3. Disruption prediction & recovery | 4.0 | 3.5 | 2.3 | 2.9 | Invest |
| 4. Ops copilot & proactive updates | 3.6 | 3.8 | 3.8 | 3.8 | Quick win |
| 5. Connected GSE & assets | 2.8 | 3.5 | 3.3 | 3.4 | Test and learn |

B · Business viability
Revenue, efficiency, cost reduction, competitive advantage, time to value

X · Experience viability
User-need fit, clear audience, motivation over today’s tools, adoption pain
Feasibility = average of experience and technical viability. Quadrants split at 3 on each axis.

T · Technical viability
Skills, integration with existing systems, natural extension, AI accuracy
Proposed scores (1–5) to validate with SATS · criteria detail in speaker notes

### Notes:
Method (Innovation Hub business envisioning guide): value = business viability score; feasibility = average of experience viability and technical viability (BXT framework). Quadrants split at 3 on each axis: Quick wins (high value, high feasibility), Invest (high value, lower feasibility), Test and learn (lower value, high feasibility), Parked (both low). All scores are proposals to validate with SATS stakeholders.

<!-- Slide number: 16 -->
# Prioritization matrix

Invest
Quick wins
5
1
High
Operational data foundation
2
Value
3
4
2
AI operations control tower
4
1
3
3
5
Disruption prediction & recovery

Parked
Test and learn
4
Ops copilot & proactive updates
2
5
1    1
Connected GSE & assets
3
2
4
5
Low
Low
Feasibility
High
Value = business viability; feasibility = average of experience and technical viability (BXT, 1–5). Proposed scores — to validate with SATS.

### Notes:
Recommended sequencing: start with use case 1 (data foundation) and use case 2 (control tower MVP) together, prototype use case 4 (ops copilot) in parallel as a fast visible win, prepare use case 3 (disruption prediction) as the strategic investment once history data is available, and pilot use case 5 (connected GSE) at one pier.

<!-- Slide number: 17 -->
# Next steps
| Next step | Owner | Target date |
| --- | --- | --- |
| All — share output; confirm each step in writing | Innovation Hub TA | 4 Nov 2026 |
| All — validate BXT scores and KR baselines | SATS COO office + Hub TA | 13 Nov 2026 |
| UC1 — data-source inventory; EDH-to-Fabric review | SATS Data Lead + Microsoft Data & AI | 20 Nov 2026 |
| UC2, UC4 — solution envisioning at the Hub | Hub TA + SATS Control Tower Lead | 27 Nov 2026 |
| UC4 — prototype ops assistant on SOPs and reports | SATS Customer Service Lead + partner | 11 Dec 2026 |
| UC3 — extract 12–24 months of disruption history | SATS Data Lead + SIOC | 18 Dec 2026 |
| UC5 — scope a connected-cart pilot at one pier | SATS Fleet / Asset Lead | 15 Jan 2027 |
| All — agree funding, partner and sponsor sign-off | Microsoft AE + SATS COO | 22 Jan 2027 |

OVERALL TIMEFRAME

1 · Data foundation
4–6 months

2 · Control tower
4–6 months

3 · Disruption prediction
> 6 months

4 · Ops copilot
1–3 months

5 · Connected GSE
4–6 months
Each owner to confirm acceptance of their step and date in writing (email or Teams). Dates are proposals.

<!-- Slide number: 18 -->
# Parking lot
| Use case | Description | Evidence of value and feasibility |
| --- | --- | --- |
| 6 · Stand and resource allocation optimiser | AI optimisation of stand and task allocation under hard and soft constraints, re-run as conditions change | Reference: a Middle East airport stand-planning optimiser (~9,300 variables, ~17,600 constraints, ~200 live messages per second). Overlaps use case 3; needs CAG data access |
| 7 · Turnaround milestones from video | Airside video analytics auto-captures turnaround events (chocks on, doors, loading) to feed the control tower | Airside video analytics already in the SATS blueprint; needs camera coverage, privacy and CAG review |
| 8 · Digitise analog processes | Low-code apps replace paper, radio and chat-based logs so the data lands in EDH | SPEAR initiative; high feasibility, value mainly as a data enabler for use cases 1 and 2 |
| 9 · Autonomous equipment orchestration | Dispatch and monitor AV tractors, AV buses and auto-dollies from the control tower | Automation in the SATS blueprint; depends on vendor interfaces and safety certification |
| 10 · Demand-driven workforce planning | Link GroundStar planning and rostering to predicted demand and disruption | Addresses manpower shortage; depends on GroundStar integration and HR / union engagement |

HOW TO ADVANCE THESE

Revisit at solution envisioning. Each needs an owner and a data check before BXT scoring.

Candidates 6 and 7 extend use cases 3 and 2 once the data foundation is live.
Reference figures from case studies in SATS Project SPEAR Playback #1