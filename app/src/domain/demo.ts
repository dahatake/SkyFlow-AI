import type { Mitigation, Scenario } from './types';

export interface DecisionOption {
  id: string;
  label: string;
  detail: string;
  tradeoff: string;
  /** Relative effort/cost 0-3, used as a tie-breaker by Copilot assist. */
  cost: number;
  mitigations: Mitigation[];
  /** 5W2H action tasks created when this option is chosen. */
  tasks: TaskTemplate[];
}
export interface TaskTemplate { what: string; who: string; where: string; how: string; howMuch: string; start: number; dur: number; priority: 1 | 2 | 3 }
export interface DecisionTask {
  id: string;
  title: string;
  area: 'Staff' | 'Crew' | 'Facility' | 'Gate' | 'Schedule';
  question: string;
  owner: string;
  options: DecisionOption[];
}
export interface DemoPack {
  id: string;
  title: string;
  blurb: string;
  scenario: Omit<Scenario, 'createdAt' | 'state'>;
  decisions: DecisionTask[];
}

const NONE = (detail: string): DecisionOption => ({ id: 'none', label: 'No action', detail, tradeoff: 'Impact stays as simulated.', cost: 0, mitigations: [], tasks: [] });

export const DEMO_PACK: DemoPack[] = [
  {
    id: 'demo-weather',
    title: 'Weather delay',
    blurb: 'Lightning stops ramp work on Piers A and B for 60 min plus recovery.',
    scenario: {
      id: 'demo-weather', name: 'Demo: Weather delay', notes: 'Ramp stoppage on Piers A and B (60 min + 45 min recovery).',
      params: { weather: { startOffsetMin: 10, durationMin: 60, piers: ['A', 'B'], severity: 'High', recoveryBufferMin: 45 } },
    },
    decisions: [
      {
        id: 'wx-gate', title: 'Re-gate flights away from the storm cell', area: 'Gate', owner: 'SIOC Duty Manager',
        question: 'Piers A and B are under the stoppage. Should flights be moved to Pier C stands (C6 is closed for maintenance)?',
        options: [
          NONE('Keep flights on their allocated stands and wait out the stoppage.'),
          { id: 'regate-c', label: 'Move Pier A/B flights to Pier C', detail: 'Tow/re-allocate affected turnarounds to open Pier C stands.', tradeoff: 'Pier C stands become crowded; towing and passenger re-routing effort.', cost: 2, mitigations: [{ kind: 'gate', fromPiers: ['A', 'B'], toPier: 'C' }], tasks: [{ what: 'Tow and re-allocate Pier A/B flights to Pier C stands', who: 'u-sioc1', where: 'Piers A/B to Pier C', how: 'Stand swap in AODB, tug crews follow the departure-time order', howMuch: '~12 tows, about S$4.8k', start: 0, dur: 25, priority: 1 }, { what: 'Re-brief Pier C ramp crew for the added flights', who: 'u-ramp1', where: 'Pier C', how: 'Radio briefing with updated task cards', howMuch: '2 supervisors, 15 min', start: 5, dur: 15, priority: 2 }, { what: 'Notify airlines and passenger services of stand changes', who: 'u-sioc1', where: 'SIOC to airline ops', how: 'DCT notification plus airline WhatsApp groups', howMuch: 'No extra cost', start: 0, dur: 10, priority: 2 }] },
        ],
      },
      {
        id: 'wx-crew', title: 'Recovery crew posture', area: 'Crew', owner: 'BU Ops Manager (Ramp)',
        question: 'Add ramp crew at stoppage end to shorten the recovery buffer?',
        options: [
          NONE('Use the planned 45 minute recovery buffer.'),
          { id: 'extra-ramp', label: 'Call in 6 extra ramp crew, cut buffer by 30 min', detail: 'Pre-stage standby crew so ramp work restarts at once.', tradeoff: 'Overtime cost; crew taken from rest rota.', cost: 1, mitigations: [{ kind: 'bufferCut', minutes: 30 }], tasks: [{ what: 'Call in 6 extra ramp crew', who: 'u-bu1', where: 'Ramp crew room', how: 'Standby roster call-out by SMS', howMuch: '6 crew x 3 h overtime, about S$1.1k', start: 0, dur: 20, priority: 1 }, { what: 'Pre-stage crew at Piers A/B holding area', who: 'u-ramp1', where: 'Piers A/B', how: 'Stage crew and vehicles ready for stoppage end', howMuch: '15 min of idle time', start: 20, dur: 15, priority: 2 }] },
        ],
      },
    ],
  },
  {
    id: 'demo-flight-delay',
    title: 'Flight delay',
    blurb: 'Flight 2 arrives 60 min late and a Pier A fuel truck is out of service.',
    scenario: {
      id: 'demo-flight-delay', name: 'Demo: Flight delay', notes: 'Late inbound +60 min (medium connection sensitivity) with one Pier A fuel truck down for 2 h.',
      params: {
        lateInbound: { flightId: 'fl-2', delayMin: 60, standId: 'A2', sensitivity: 'Med' },
        gse: { assetType: 'Fuel Truck', quantityUnavailable: 1, pier: 'A', durationMin: 120 },
      },
    },
    decisions: [
      {
        id: 'fd-crew', title: 'Re-plan ground crew for the late flight', area: 'Crew', owner: 'SIOC Duty Manager',
        question: 'Flight 2 will land 60 min late. Can turnaround crews be re-timed to claw back time?',
        options: [
          NONE('Run the turnaround to the original crew plan.'),
          { id: 'pre-stage', label: 'Pre-stage baggage and pushback crew (−30 min)', detail: 'Hold crews at the stand so offload starts at chocks-on.', tradeoff: 'Two crews idle until arrival.', cost: 1, mitigations: [{ kind: 'recover', flightId: 'fl-2', minutes: 30 }], tasks: [{ what: 'Pre-stage baggage and pushback crew at stand A2', who: 'u-bu2', where: 'Stand A2', how: 'Move crew 20 min before ATA and brief on offload order', howMuch: '2 crews idle about 30 min', start: 0, dur: 30, priority: 1 }, { what: 'Update crew roster for the late turnaround', who: 'u-ramp1', where: 'SIOC roster board', how: 'Edit shift plan and confirm breaks', howMuch: 'No extra cost', start: 0, dur: 10, priority: 3 }] },
          { id: 'fast-turn', label: 'Fast-turn protocol (−50 min)', detail: 'Parallel offload, refuel and catering with extra supervisors.', tradeoff: 'Highest crew load; risk of safety shortcuts needs duty-manager sign-off.', cost: 3, mitigations: [{ kind: 'recover', flightId: 'fl-2', minutes: 50 }], tasks: [{ what: 'Brief fast-turn protocol and assign supervisors', who: 'u-sioc1', where: 'Stand A2', how: 'Parallel offload, refuel and catering with a named lead each', howMuch: '3 extra supervisors', start: 0, dur: 20, priority: 1 }, { what: 'Run parallel refuel, catering and offload', who: 'u-ramp1', where: 'Stand A2', how: 'Execute the fast-turn plan at chocks-on', howMuch: 'Highest crew load', start: 30, dur: 40, priority: 1 }, { what: 'Duty-manager safety sign-off for the fast turn', who: 'u-lead', where: 'SIOC', how: 'Review checklist and approve deviations', howMuch: '10 min review', start: 0, dur: 10, priority: 1 }] },
        ],
      },
      {
        id: 'fd-gse', title: 'Restore fuel capacity on Pier A', area: 'Facility', owner: 'BU Ops Manager (Ramp)',
        question: 'A Pier A fuel truck is unavailable. Borrow one from Pier C or wait for repair?',
        options: [
          NONE('Wait for the fuel truck to return (about 2 h).'),
          { id: 'borrow-fuel', label: 'Borrow a fuel truck from Pier C', detail: 'Reassign a spare truck across the apron.', tradeoff: 'Pier C has one fewer truck during the window.', cost: 1, mitigations: [{ kind: 'gse', assetType: 'Fuel Truck', pier: 'A', qty: 1 }], tasks: [{ what: 'Move a spare fuel truck from Pier C to Pier A', who: 'u-own1', where: 'Pier C to Pier A', how: 'Driver reassigns truck and updates the GSE register', howMuch: '1 truck, 10 min transit', start: 0, dur: 15, priority: 1 }, { what: 'Update the GSE allocation board', who: 'u-bu1', where: 'SIOC GSE board', how: 'Mark transfer and return time', howMuch: 'No extra cost', start: 0, dur: 5, priority: 3 }] },
        ],
      },
      {
        id: 'fd-gate', title: 'Re-gate the late flight', area: 'Gate', owner: 'SIOC Duty Manager',
        question: 'Move flight 2 to a free Pier C stand nearer the connection hub?',
        options: [
          NONE('Keep flight 2 on stand A2.'),
          { id: 'regate-c', label: 'Move flight 2 to Pier C', detail: 'Shorter taxi and passenger walk to connections.', tradeoff: 'Needs a stand swap and re-briefing of Pier C crew.', cost: 1, mitigations: [{ kind: 'gate', fromPiers: [], toPier: 'C', flightIds: ['fl-2'], savesMin: 15 }], tasks: [{ what: 'Re-allocate flight 2 to a free Pier C stand', who: 'u-sioc1', where: 'Stand A2 to Pier C', how: 'Stand swap in AODB and tug booking', howMuch: '1 tow', start: 0, dur: 15, priority: 2 }, { what: 'Re-brief connection hub and passenger services', who: 'u-bu1', where: 'Transfer hub', how: 'Update walking route and meeting points', howMuch: '1 coordinator', start: 10, dur: 15, priority: 2 }] },
        ],
      },
    ],
  },
  {
    id: 'demo-no-staff',
    title: 'No ground staff',
    blurb: 'Ramp Services loses 80% of its crew for the next 4 hours.',
    scenario: {
      id: 'demo-no-staff', name: 'Demo: No ground staff', notes: 'Ramp Services capacity −80% for 240 min.',
      params: { staff: { buId: 'bu-ramp', capacityDeltaPct: 80, windowMin: 240 } },
    },
    decisions: [
      {
        id: 'ns-source', title: 'Source replacement ramp crew', area: 'Staff', owner: 'BU Ops Manager (Ramp)',
        question: 'Where do replacement ramp crew come from?',
        options: [
          NONE('Operate with the remaining 20% of the crew.'),
          { id: 'standby', label: 'Call in 20 standby crew', detail: 'Activate the off-duty standby roster.', tradeoff: 'Overtime cost and response time of about 45 min.', cost: 2, mitigations: [{ kind: 'staff', buId: 'bu-ramp', add: 20 }], tasks: [{ what: 'Activate the 20-person standby ramp roster', who: 'u-bu1', where: 'Ramp crew room', how: 'Call-out by SMS and phone, confirm ETA of about 45 min', howMuch: '20 crew, overtime about S$3.6k', start: 0, dur: 45, priority: 1 }, { what: 'Arrange crew transport and induction briefing', who: 'u-ramp1', where: 'Crew transport bay', how: 'Shuttle plus 10 min safety briefing', howMuch: '2 vans', start: 10, dur: 30, priority: 2 }, { what: 'Confirm certifications of called-in crew', who: 'u-own2', where: 'Training records', how: 'Check airside licence and GSE authorisations', howMuch: '1 officer', start: 0, dur: 15, priority: 2 }] },
          { id: 'redeploy', label: 'Redeploy 12 crew from Baggage Handling', detail: 'Cross-skilled baggage handlers support the ramp.', tradeoff: 'Baggage Handling pressure rises and may start to slip.', cost: 1, mitigations: [{ kind: 'staff', buId: 'bu-ramp', add: 12, fromBuId: 'bu-bag' }], tasks: [{ what: 'Redeploy 12 cross-skilled baggage crew to the ramp', who: 'u-bu2', where: 'Baggage hall to ramp', how: 'Release crew and confirm skills matrix', howMuch: '12 crew', start: 0, dur: 20, priority: 1 }, { what: 'Re-plan baggage schedule with reduced crew', who: 'u-bu2', where: 'Baggage Handling', how: 'Prioritise departures and defer low-risk loads', howMuch: '1 planner', start: 10, dur: 25, priority: 2 }] },
        ],
      },
      {
        id: 'ns-scope', title: 'Defer low-priority work', area: 'Schedule', owner: 'SIOC Duty Manager',
        question: 'Defer priority-3 tasks (for example catering loads) to protect critical work?',
        options: [
          NONE('Keep full service scope.'),
          { id: 'defer-p3', label: 'Defer priority-3 tasks', detail: 'Catering loads move behind refuelling and pushback.', tradeoff: 'Catering delays may affect on-board service quality.', cost: 1, mitigations: [{ kind: 'deferLow' }], tasks: [{ what: 'Re-sequence priority-3 catering tasks behind critical work', who: 'u-sioc1', where: 'Ramp task board', how: 'Reorder task queue by priority', howMuch: 'No extra cost', start: 0, dur: 10, priority: 2 }, { what: 'Notify airlines of catering delays', who: 'u-sioc1', where: 'SIOC to airline ops', how: 'DCT message with revised catering times', howMuch: 'No extra cost', start: 5, dur: 10, priority: 3 }] },
        ],
      },
    ],
  },
];

export const demoById = (id: string) => DEMO_PACK.find((d) => d.id === id);

/** Mitigations implied by the decisions recorded on a scenario. */
export function activeMitigations(sc: Scenario | null | undefined, override?: Record<string, string>): Mitigation[] {
  const pack = sc && demoById(sc.id);
  if (!sc || !pack) return [];
  return pack.decisions.flatMap((d) => {
    const optId = override?.[d.id] ?? sc.decisions?.[d.id]?.optionId;
    return d.options.find((o) => o.id === optId)?.mitigations ?? [];
  });
}
