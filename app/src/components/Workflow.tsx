import { useMemo } from 'react';
import { ArrowCircleRight24Filled, CheckmarkCircle24Filled, Circle24Regular, Flag24Regular } from '@fluentui/react-icons';
import { demoById } from '../domain/demo';
import { fmt } from '../domain/seed';
import type { ExceptionState } from '../domain/types';
import { useOps } from '../storage/store';
import { EX_STAGES, nextState } from './Views';

interface Step { key: string; n: number; label: string; desc: string; count: number; todo: string; cta?: { label: string; run(): void } }

/** Big response workflow: Detect → Acknowledge → Assign → Decide → Monitor → Resolve. Status is derived from exception states. */
export function WorkflowPanel() {
  const { view, baseline, advance, role, scenarios, activeId, setTab, copilotAll, wf } = useOps();
  const can = role !== 'Observer';
  const b = baseline;
  const data = useMemo(() => {
    const all = b.exceptions.map((e) => ({ e, st: view.statusOf(e) }));
    const by = (s: ExceptionState) => all.filter((x) => x.st === s).map((x) => x.e);
    const sc = scenarios.find((s) => s.id === activeId);
    const pack = sc && demoById(sc.id);
    const decided = pack ? pack.decisions.filter((t) => sc.decisions?.[t.id]).length : 0;
    return { all, by, pack, decided, total: all.length };
  }, [view, b, scenarios, activeId, wf]);

  const suggestOwner = (id: string) => {
    const e = b.exceptions.find((x) => x.id === id)!;
    const t = b.tasks.find((k) => e.affectedEntityIds.includes(k.id));
    return view.ownerIdOf(e) ?? t?.ownerId ?? 'u-sioc1';
  };
  const ids = (s: ExceptionState) => data.by(s).map((e) => e.id);

  const steps: Step[] = [
    { key: 'detect', n: 1, label: 'Detect', desc: 'Exceptions surfaced from DSM, DCT, G-Ops, Mosaic', count: data.by('New').length,
      todo: `${data.by('New').length} new exception(s) need acknowledgement`,
      cta: data.by('New').length ? { label: 'Acknowledge all', run: () => advance(ids('New'), 'Acknowledged') } : undefined },
    { key: 'ack', n: 2, label: 'Acknowledge', desc: 'Confirm someone has seen it', count: data.by('Acknowledged').length,
      todo: `${data.by('Acknowledged').length} acknowledged without an owner plan`,
      cta: data.by('Acknowledged').length ? { label: 'Assign suggested owners', run: () => advance(ids('Acknowledged'), 'Assigned', suggestOwner) } : undefined },
    { key: 'assign', n: 3, label: 'Assign owner', desc: 'Named owner and target time for each exception', count: data.by('Assigned').length,
      todo: `${data.by('Assigned').length} assigned and waiting for a decision`,
      cta: data.by('Assigned').length ? { label: 'Start recovery', run: () => advance(ids('Assigned'), 'Monitoring') } : undefined },
    { key: 'decide', n: 4, label: 'Decide', desc: 'People and Copilot assist judge options in the simulator', count: data.pack ? data.pack.decisions.length - data.decided : 0,
      todo: data.pack ? `${data.decided}/${data.pack.decisions.length} judgement tasks decided` : 'Pick a demo scenario to get judgement tasks',
      cta: data.pack ? { label: data.decided < data.pack.decisions.length ? 'Let Copilot assist all' : 'Review decisions', run: () => (data.decided < data.pack!.decisions.length ? copilotAll() : setTab('decisions')) } : undefined },
    { key: 'monitor', n: 5, label: 'Monitor', desc: 'Track recovery against target times', count: data.by('Monitoring').length,
      todo: `${data.by('Monitoring').length} under recovery`,
      cta: data.by('Monitoring').length ? { label: 'Mark resolved', run: () => advance(ids('Monitoring'), 'Resolved') } : undefined },
    { key: 'resolve', n: 6, label: 'Resolve', desc: 'Closed with an audit trail', count: data.by('Resolved').length,
      todo: `${data.by('Resolved').length} of ${data.total} closed` },
  ];
  const pending = (s: Step) => (s.key === 'resolve' ? false : s.key === 'decide' ? !!data.pack && data.decided < data.pack.decisions.length : s.count > 0);
  const current = steps.findIndex(pending);
  const pct = Math.round((data.by('Resolved').length / Math.max(1, data.total)) * 100);

  return (
    <section className="card workflow" aria-label="Response workflow">
      <div className="row between">
        <h2><Flag24Regular /> Response workflow <small>from detection to closure · {pct}% of exceptions closed</small></h2>
        <progress max={100} value={pct} aria-label="Closed exceptions" />
      </div>
      <ol className="steps">
        {steps.map((s, i) => {
          const state = i === current ? 'current' : (i < current || current === -1) && !pending(s) ? 'done' : 'todo';
          return (
            <li key={s.key} className={`step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <div className="s-head">
                {state === 'done' ? <CheckmarkCircle24Filled /> : state === 'current' ? <ArrowCircleRight24Filled /> : <Circle24Regular />}
                <strong>{s.n}. {s.label}</strong>
                <span className="count">{s.count}</span>
              </div>
              <small>{s.desc}</small>
              <div className="s-todo">{s.todo}</div>
              {s.cta && <button className={state === 'current' ? 'primary' : ''} disabled={!can && s.key !== 'decide'} onClick={s.cta.run}>{s.cta.label}</button>}
            </li>
          );
        })}
      </ol>
      {!can && <p className="muted">Observer lens is read-only: workflow actions are disabled.</p>}
      <p className="muted">Workflow progress is stored only in this browser as a prototype overlay; no operational system is updated.</p>
    </section>
  );
}

/** Per-exception step tracker with the next action. */
export function ExceptionStepper({ id }: { id: string }) {
  const { view, baseline, advance, role } = useOps();
  const e = baseline.exceptions.find((x) => x.id === id);
  if (!e) return null;
  const st = view.statusOf(e);
  const idx = EX_STAGES.findIndex((s) => s.key === st);
  const n = nextState(st);
  const owner = view.ownerIdOf(e);
  const candidates = baseline.stakeholders.filter((s) => s.roleType !== 'Observer');
  return (
    <div className="ex-stepper" aria-label="Exception workflow">
      <ol>{EX_STAGES.map((s, i) => <li key={s.key} className={i < idx ? 'done' : i === idx ? 'current' : ''}>{i < idx ? '✓' : i + 1} {s.label}</li>)}</ol>
      {n && role !== 'Observer' && (
        <div className="row">
          {n === 'Assigned' && (
            <label>Owner <select value={owner ?? ''} onChange={(ev) => advance([id], 'Assigned', ev.target.value || null)}>
              <option value="">Unassigned</option>{candidates.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
            </select></label>
          )}
          <button className="primary" onClick={() => advance([id], n, n === 'Assigned' ? owner ?? 'u-sioc1' : undefined)}>Next: {EX_STAGES.find((s) => s.key === n)!.label}</button>
          <small>Due {fmt(e.targetTime)}</small>
        </div>
      )}
    </div>
  );
}
