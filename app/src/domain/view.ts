import type { AssetState, Baseline, ExceptionState, Impact, OpException, Scenario, Severity, SlaLevel, TaskState } from './types';
import { SEVERITY_ORDER, SLA_ORDER } from './types';
import { emptyImpact } from './scenario';

export type SimMode = 'baseline' | 'scenario' | 'difference';

export interface Filters { bu: string; pier: string; airline: string; severity: string; owner: string; window: 'all' | '60' | '120' }
export const noFilters: Filters = { bu: '', pier: '', airline: '', severity: '', owner: '', window: 'all' };
export interface Selection { kind: string; id: string }

/** Single projection used by every component so no panel can disagree with another (FR-001). */
export class OpsView {
  readonly impact: Impact;
  constructor(readonly b: Baseline, readonly mode: SimMode, impact: Impact | undefined, readonly f: Filters, readonly kpiIds: string[] | null, readonly timePos: number | null = null, readonly wf: Record<string, { status: ExceptionState; ownerId?: string }> = {}) {
    this.impact = mode === 'baseline' || !impact ? emptyImpact() : impact;
    this.simulated = mode !== 'baseline' && !!impact;
  }
  simulated: boolean;

  turnRisk(id: string): SlaLevel {
    const t = this.b.turnarounds.find((x) => x.id === id)!;
    const s = this.impact.turnaroundRisk[id];
    return s && SLA_ORDER.indexOf(s) > SLA_ORDER.indexOf(t.slaRisk) ? s : t.slaRisk;
  }
  taskState(id: string): TaskState { return this.impact.taskRisk[id] ?? this.b.tasks.find((x) => x.id === id)!.status; }
  assetState(id: string): AssetState { return this.impact.assetState[id] ?? this.b.assets.find((x) => x.id === id)!.status; }
  severity(e: OpException): Severity { return this.impact.exceptionSeverity[e.id] ?? e.severity; }
  delay(flightId: string) { return this.impact.flightDelay[flightId] ?? 0; }
  changed(id: string) { return this.simulated && this.impact.impactedIds.includes(id); }
  label(id: string): 'Baseline' | 'Simulated' { return this.changed(id) ? 'Simulated' : 'Baseline'; }

  standOf(f: { id: string; standId: string }) { return this.impact.standOverride[f.id] ?? f.standId; }
  pierOf(f: { id: string; standId: string }) { return this.b.stands.find((s) => s.id === this.standOf(f))!.pier; }
  moved(f: { id: string }) { return !!this.impact.standOverride[f.id]; }

  statusOf(e: OpException): ExceptionState { return this.wf[e.id]?.status ?? e.status; }
  ownerIdOf(e: OpException): string | undefined { const w = this.wf[e.id]; return w && 'ownerId' in w ? w.ownerId : e.ownerId; }

  ownerName(id?: string) { return id ? this.b.stakeholders.find((s) => s.id === id)?.displayName ?? id : 'Unassigned'; }
  airlineOf(flightId: string) { return this.b.airlines.find((a) => a.id === this.b.flights.find((f) => f.id === flightId)?.airlineId); }

  flightMatches = (id: string): boolean => {
    const fl = this.b.flights.find((x) => x.id === id)!;
    const f = this.f;
    if (f.pier && this.pierOf(fl) !== f.pier) return false;
    if (f.airline && fl.airlineId !== f.airline) return false;
    if (f.window !== 'all' && fl.sta > this.b.now + Number(f.window)) return false;
    // Scrubbed time position: only flights on stand at that moment (null = live, no time filter).
    if (this.timePos !== null && !(fl.sta <= this.timePos && this.timePos <= fl.std + this.delay(id))) return false;
    if (f.bu || f.owner) {
      const ta = this.b.turnarounds.find((t) => t.flightId === id)!;
      const ok = this.b.tasks.some((t) => t.turnaroundId === ta.id && (!f.bu || t.buId === f.bu) && (!f.owner || t.ownerId === f.owner));
      if (!ok) return false;
    }
    return true;
  };

  get flights() {
    return this.b.flights.filter((fl) => {
      if (!this.flightMatches(fl.id)) return false;
      if (this.f.severity && !this.exceptionsFor(fl.id).some((e) => this.severity(e) === this.f.severity)) return false;
      return !this.kpiIds || this.kpiIds.includes(fl.id);
    });
  }
  exceptionsFor(flightId: string) {
    const ta = this.b.turnarounds.find((t) => t.flightId === flightId)!;
    return this.b.exceptions.filter((e) => e.affectedEntityIds.includes(flightId) || e.affectedEntityIds.includes(ta.id));
  }
  get exceptions() {
    const fl = new Set(this.flights.map((x) => x.id));
    return this.b.exceptions
      .filter((e) => this.statusOf(e) !== 'Resolved')
      .filter((e) => (!this.f.severity || this.severity(e) === this.f.severity) && (!this.f.owner || this.ownerIdOf(e) === this.f.owner || (this.f.owner === 'unassigned' && !this.ownerIdOf(e))))
      .filter((e) => e.affectedEntityIds.some((i) => fl.has(i)) || !(this.f.bu || this.f.pier || this.f.airline || this.f.window !== 'all' || this.kpiIds))
      .sort((a, b) => SEVERITY_ORDER.indexOf(this.severity(b)) - SEVERITY_ORDER.indexOf(this.severity(a)) || a.detectedAt - b.detectedAt);
  }

  /** Ids related to a selection, driving cross-view highlighting (FR-006). */
  related(sel: Selection | null): Set<string> {
    const out = new Set<string>();
    if (!sel) return out;
    const b = this.b;
    const add = (...ids: (string | undefined)[]) => ids.forEach((i) => i && out.add(i));
    add(sel.id);
    const flightIds: string[] = [];
    if (sel.kind === 'flight') flightIds.push(sel.id);
    if (sel.kind === 'turnaround') flightIds.push(b.turnarounds.find((t) => t.id === sel.id)?.flightId ?? '');
    if (sel.kind === 'stand') flightIds.push(...b.flights.filter((f) => this.standOf(f) === sel.id).map((f) => f.id));
    if (sel.kind === 'task') flightIds.push(b.flights.find((f) => f.id === b.turnarounds.find((t) => t.id === b.tasks.find((k) => k.id === sel.id)?.turnaroundId)?.flightId)?.id ?? '');
    if (sel.kind === 'asset') flightIds.push(...b.tasks.filter((t) => t.assetId === sel.id).map((t) => b.turnarounds.find((x) => x.id === t.turnaroundId)!.flightId));
    if (sel.kind === 'exception') {
      const e = b.exceptions.find((x) => x.id === sel.id);
      e?.affectedEntityIds.forEach((i) => { add(i); if (i.startsWith('fl-')) flightIds.push(i); });
      add(e?.ownerId);
    }
    flightIds.filter(Boolean).forEach((fid) => {
      const f = b.flights.find((x) => x.id === fid)!;
      const ta = b.turnarounds.find((t) => t.flightId === fid)!;
      add(f.id, this.standOf(f), ta.id);
      b.tasks.filter((t) => t.turnaroundId === ta.id).forEach((t) => add(t.id, t.assetId, t.ownerId));
      b.milestones.filter((m) => m.turnaroundId === ta.id).forEach((m) => add(m.id));
      this.exceptionsFor(fid).forEach((e) => add(e.id));
    });
    return out;
  }

  kpis() {
    const flights = this.flights;
    const fl = new Set(flights.map((f) => f.id));
    const tas = this.b.turnarounds.filter((t) => fl.has(t.flightId));
    const atRisk = flights.filter((f) => ['AtRisk', 'Breach'].includes(this.turnRisk(this.b.turnarounds.find((t) => t.flightId === f.id)!.id)));
    const tasIds = new Set(tas.map((t) => t.id));
    const delayed = this.b.milestones.filter((m) => tasIds.has(m.turnaroundId) && (m.forecastTime + (this.impact.milestoneShift[m.id] ?? 0) > m.plannedTime && m.status !== 'Complete'));
    const slaRisk = tas.filter((t) => this.turnRisk(t.id) !== 'Normal');
    const engaged = this.b.assets.filter((a) => this.assetState(a.id) === 'Engaged');
    const avail = this.b.assets.filter((a) => this.assetState(a.id) === 'Available');
    const ex = this.exceptions;
    const open = this.b.actions.filter((a) => ex.some((e) => e.id === a.exceptionId));
    return [
      { key: 'volume', label: 'Operational volume', value: flights.length, ids: flights.map((f) => f.id) },
      { key: 'risk', label: 'Flights at risk', value: atRisk.length, ids: atRisk.map((f) => f.id) },
      { key: 'exceptions', label: 'Active exceptions', value: ex.length, ids: ex.flatMap((e) => e.affectedEntityIds.filter((i) => i.startsWith('fl-'))) },
      { key: 'sla', label: 'SLA risk', value: slaRisk.length, ids: slaRisk.map((t) => t.flightId) },
      { key: 'milestones', label: 'Delayed milestones', value: delayed.length, ids: [...new Set(delayed.map((m) => this.b.turnarounds.find((t) => t.id === m.turnaroundId)!.flightId))] },
      { key: 'gse', label: 'GSE avail / engaged', value: `${avail.length} / ${engaged.length}`, ids: [] as string[] },
      { key: 'actions', label: 'Open owner actions', value: open.length, ids: open.flatMap((a) => this.b.exceptions.find((e) => e.id === a.exceptionId)!.affectedEntityIds.filter((i) => i.startsWith('fl-'))) },
    ];
  }
}
