import type { ExceptionState, OpException, Severity } from './types';
import type { OpsView } from './view';

/** SLA targets for manager actions on exceptions (minutes from detection). */
export const SLA = { ack: 2, action: 5 } as const;

export interface ActionRow {
  id: string; type: string; severity: Severity; ownerId?: string; detectedAt: number;
  ackAt?: number; actAt?: number; ackMin?: number; actMin?: number;
  ackState: 'met' | 'breached' | 'pending'; actState: 'met' | 'breached' | 'pending';
  priority: boolean;
}
export interface SlaKpi { key: string; label: string; target: string; met: number; breached: number; pending: number; pct: number | null }

function hash(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return (x ^ (x >>> 15)) >>> 0;
}
const ACTED: ExceptionState[] = ['Assigned', 'Monitoring', 'Resolved'];

/**
 * Seeded exceptions carry no action history, so past acknowledgements/actions are derived deterministically from the
 * exception id. Actions taken in the UI are recorded with real operational timestamps and override the derived ones.
 */
export function actionRows(view: OpsView): ActionRow[] {
  const now = view.b.now;
  return view.b.exceptions.map((e: OpException) => {
    const st = view.statusOf(e);
    const w = view.wf[e.id];
    const h = hash(e.id);
    const okTs = (t?: number) => (t !== undefined && t >= e.detectedAt && t <= now ? t : undefined);
    const ackAt = okTs(w?.ackAt) ?? (st !== 'New' ? Math.min(now, e.detectedAt + 1 + (h % 3)) : undefined);
    const actAt = okTs(w?.actAt) ?? (ACTED.includes(st) ? Math.min(now, (ackAt ?? e.detectedAt) + (h >>> 4) % 5) : undefined);
    const age = now - e.detectedAt;
    const ackMin = ackAt === undefined ? undefined : ackAt - e.detectedAt;
    const actMin = actAt === undefined ? undefined : actAt - e.detectedAt;
    const sev = view.severity(e);
    return {
      id: e.id, type: e.type, severity: sev, ownerId: view.ownerIdOf(e), detectedAt: e.detectedAt, ackAt, actAt, ackMin, actMin,
      ackState: ackMin === undefined ? (age > SLA.ack ? 'breached' : 'pending') : ackMin <= SLA.ack ? 'met' : 'breached',
      actState: actMin === undefined ? (age > SLA.action ? 'breached' : 'pending') : actMin <= SLA.action ? 'met' : 'breached',
      priority: sev === 'Critical' || sev === 'High',
    };
  });
}

function kpi(key: string, label: string, target: string, rows: ActionRow[], pick: (r: ActionRow) => 'met' | 'breached' | 'pending'): SlaKpi {
  const s = rows.map(pick);
  const met = s.filter((x) => x === 'met').length, breached = s.filter((x) => x === 'breached').length;
  return { key, label, target, met, breached, pending: s.length - met - breached, pct: met + breached ? Math.round((100 * met) / (met + breached)) : null };
}

export function slaKpis(rows: ActionRow[]): SlaKpi[] {
  return [
    kpi('ack', 'Acknowledged by owner', `≤ ${SLA.ack} min from detection`, rows, (r) => r.ackState),
    kpi('action', 'Detection-to-action', `≤ ${SLA.action} min from detection`, rows, (r) => r.actState),
    kpi('priority', 'Priority exceptions actioned', `Critical / High, ≤ ${SLA.action} min`, rows.filter((r) => r.priority), (r) => r.actState),
  ];
}
