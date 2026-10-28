import type { Mitigation, Scenario } from './types';

export interface DecisionOption {
  id: string;
  label: string;
  detail: string;
  tradeoff: string;
  /** Relative effort/cost 0-3, used as a tie-breaker by Copilot assist. */
  cost: number;
  mitigations: Mitigation[];
}
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

const NONE = (detail: string): DecisionOption => ({ id: 'none', label: 'No action', detail, tradeoff: 'Impact stays as simulated.', cost: 0, mitigations: [] });

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
          { id: 'regate-c', label: 'Move Pier A/B flights to Pier C', detail: 'Tow/re-allocate affected turnarounds to open Pier C stands.', tradeoff: 'Pier C stands become crowded; towing and passenger re-routing effort.', cost: 2, mitigations: [{ kind: 'gate', fromPiers: ['A', 'B'], toPier: 'C' }] },
        ],
      },
      {
        id: 'wx-crew', title: 'Recovery crew posture', area: 'Crew', owner: 'BU Ops Manager (Ramp)',
        question: 'Add ramp crew at stoppage end to shorten the recovery buffer?',
        options: [
          NONE('Use the planned 45 minute recovery buffer.'),
          { id: 'extra-ramp', label: 'Call in 6 extra ramp crew, cut buffer by 30 min', detail: 'Pre-stage standby crew so ramp work restarts at once.', tradeoff: 'Overtime cost; crew taken from rest rota.', cost: 1, mitigations: [{ kind: 'bufferCut', minutes: 30 }] },
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
          { id: 'pre-stage', label: 'Pre-stage baggage and pushback crew (−30 min)', detail: 'Hold crews at the stand so offload starts at chocks-on.', tradeoff: 'Two crews idle until arrival.', cost: 1, mitigations: [{ kind: 'recover', flightId: 'fl-2', minutes: 30 }] },
          { id: 'fast-turn', label: 'Fast-turn protocol (−50 min)', detail: 'Parallel offload, refuel and catering with extra supervisors.', tradeoff: 'Highest crew load; risk of safety shortcuts needs duty-manager sign-off.', cost: 3, mitigations: [{ kind: 'recover', flightId: 'fl-2', minutes: 50 }] },
        ],
      },
      {
        id: 'fd-gse', title: 'Restore fuel capacity on Pier A', area: 'Facility', owner: 'BU Ops Manager (Ramp)',
        question: 'A Pier A fuel truck is unavailable. Borrow one from Pier C or wait for repair?',
        options: [
          NONE('Wait for the fuel truck to return (about 2 h).'),
          { id: 'borrow-fuel', label: 'Borrow a fuel truck from Pier C', detail: 'Reassign a spare truck across the apron.', tradeoff: 'Pier C has one fewer truck during the window.', cost: 1, mitigations: [{ kind: 'gse', assetType: 'Fuel Truck', pier: 'A', qty: 1 }] },
        ],
      },
      {
        id: 'fd-gate', title: 'Re-gate the late flight', area: 'Gate', owner: 'SIOC Duty Manager',
        question: 'Move flight 2 to a free Pier C stand nearer the connection hub?',
        options: [
          NONE('Keep flight 2 on stand A2.'),
          { id: 'regate-c', label: 'Move flight 2 to Pier C', detail: 'Shorter taxi and passenger walk to connections.', tradeoff: 'Needs a stand swap and re-briefing of Pier C crew.', cost: 1, mitigations: [{ kind: 'gate', fromPiers: [], toPier: 'C', flightIds: ['fl-2'], savesMin: 15 }] },
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
          { id: 'standby', label: 'Call in 20 standby crew', detail: 'Activate the off-duty standby roster.', tradeoff: 'Overtime cost and response time of about 45 min.', cost: 2, mitigations: [{ kind: 'staff', buId: 'bu-ramp', add: 20 }] },
          { id: 'redeploy', label: 'Redeploy 12 crew from Baggage Handling', detail: 'Cross-skilled baggage handlers support the ramp.', tradeoff: 'Baggage Handling pressure rises and may start to slip.', cost: 1, mitigations: [{ kind: 'staff', buId: 'bu-ramp', add: 12, fromBuId: 'bu-bag' }] },
        ],
      },
      {
        id: 'ns-scope', title: 'Defer low-priority work', area: 'Schedule', owner: 'SIOC Duty Manager',
        question: 'Defer priority-3 tasks (for example catering loads) to protect critical work?',
        options: [
          NONE('Keep full service scope.'),
          { id: 'defer-p3', label: 'Defer priority-3 tasks', detail: 'Catering loads move behind refuelling and pushback.', tradeoff: 'Catering delays may affect on-board service quality.', cost: 1, mitigations: [{ kind: 'deferLow' }] },
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
