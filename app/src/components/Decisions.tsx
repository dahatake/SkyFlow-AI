import { useMemo, type ReactNode } from 'react';
import {
  Bot24Regular, Checkmark24Filled, Person24Regular, ArrowUndo24Regular, Building24Regular, ClipboardTaskListLtr24Regular, People24Regular, ArrowSwap24Regular, Wrench24Regular, CalendarClock24Regular, Sparkle24Regular,
} from '@fluentui/react-icons';
import { computeImpact } from '../domain/scenario';
import { activeMitigations, demoById, type DecisionTask } from '../domain/demo';
import { advise, evaluate, scoreImpact, type Score } from '../domain/judgement';
import { useOps } from '../storage/store';
import { Tag } from './ui';
import { tr } from '../i18n';
import { trData } from '../i18n/data';

const AREA_ICON: Record<DecisionTask['area'], ReactNode> = {
  Staff: <People24Regular />, Crew: <People24Regular />, Facility: <Wrench24Regular />, Gate: <ArrowSwap24Regular />, Schedule: <CalendarClock24Regular />,
};

const fmtDelta = (a: number, b: number, lowerBetter = true) => {
  const d = b - a;
  if (d === 0) return <span className="muted">±0</span>;
  const good = lowerBetter ? d < 0 : d > 0;
  return <span className={good ? 'good' : 'bad'}>{d > 0 ? '+' : ''}{d}</span>;
};

function ScoreStrip({ label, s, vs: r }: { label: string; s: Score; vs?: Score }) {
  const cells: [string, keyof Score][] = [[tr('Flights at risk'), 'atRisk'], [tr('Breaches'), 'breach'], [tr('Blocked tasks'), 'blocked'], [tr('Escalations'), 'escalated']];
  return (
    <div className="score">
      <strong>{label}</strong>
      {cells.map(([l, k]) => <span key={k}>{l}: <b>{s[k]}</b>{r && <> {fmtDelta(r[k], s[k])}</>}</span>)}
    </div>
  );
}

const opt_tasks = (t: DecisionTask, optionId: string) => t.options.find((o) => o.id === optionId)?.tasks.length ?? 0;

export function DecisionQueue({ compact = false }: { compact?: boolean }) {
  const { scenarios, activeId, baseline, decide, undoDecision, copilotAll, role, view, setTab } = useOps();
  const sc = scenarios.find((s) => s.id === activeId) ?? null;
  const pack = sc && demoById(sc.id);
  const none = useMemo(() => (pack ? Object.fromEntries(pack.decisions.map((t) => [t.id, 'none'])) : {}), [pack]);

  const calc = useMemo(() => {
    if (!sc || !pack) return null;
    const normal = scoreImpact(baseline, computeImpact(baseline, { ...sc, params: {}, decisions: {} }));
    const before = evaluate(baseline, sc, none);
    const current = scoreImpact(baseline, computeImpact(baseline, sc, activeMitigations(sc)));
    const advice = Object.fromEntries(pack.decisions.map((t) => [t.id, advise(baseline, sc, pack.decisions, t)]));
    return { normal, before, current, advice };
  }, [sc, pack, baseline, none]);

  if (!sc || !pack || !calc) {
    return (
      <section className="card" aria-label={tr('Decision queue')}>
        <h2><Sparkle24Regular /> {tr('Decision queue')}</h2>
        <p className="muted">{tr('Pick a demo scenario at the top to get judgement tasks. People and Copilot assist can change staff, crew, facility and gate decisions and the simulator shows the result.')}</p>
      </section>
    );
  }
  const decided = pack.decisions.filter((t) => sc.decisions?.[t.id]).length;
  const canDecide = role !== 'Observer';
  return (
    <section className="card decisions" aria-label={tr('Decision queue')}>
      <div className="row between">
        <h2><Sparkle24Regular /> {tr('Decision queue')} <small>{tr('{done}/{total} decided · {name}', { done: decided, total: pack.decisions.length, name: trData(sc.name) })}</small></h2>
        <div className="row">
          {compact && <button onClick={() => setTab('decisions')}>{tr('Open full view')}</button>}
          <button className="primary" disabled={!canDecide || decided === pack.decisions.length} onClick={copilotAll} title={tr('Accept Copilot assist suggestion for every open task')}><Bot24Regular /> {tr('Let Copilot assist all')}</button>
        </div>
      </div>
      <p className="muted">{tr('All decisions change the simulated overlay only. Copilot assist is an advisory rule-based recommendation computed by re-running the scenario engine for each option; a person always confirms.')} {!canDecide && tr('Observer lens is read-only.')}</p>

      <div className="scores" aria-label={tr('Outcome so far')}>
        <ScoreStrip label={tr('Normal day')} s={calc.normal} />
        <ScoreStrip label={tr('Disruption, no decisions')} s={calc.before} vs={calc.normal} />
        <ScoreStrip label={tr('With your decisions')} s={calc.current} vs={calc.before} />
        <p className="muted">{tr('Green = improvement vs the row above.')} <Tag simulated /> {view.simulated ? '' : tr('Switch to Scenario or Difference mode to see these effects on the board and maps.')}</p>
      </div>

      <ol className="tasks">
        {pack.decisions.map((t) => {
          const rec = sc.decisions?.[t.id];
          const adv = calc.advice[t.id];
          const current = Object.fromEntries(pack.decisions.map((x) => [x.id, sc.decisions?.[x.id]?.optionId ?? 'none']));
          return (
            <li key={t.id} className={rec ? 'task done' : 'task'}>
              <div className="th">
                <span className="ico">{AREA_ICON[t.area]}</span>
                <span><strong>{trData(t.title)}</strong><small>{tr(t.area)} · {tr('owner')}: {tr(t.owner)}</small></span>
                {rec ? <span className="badge ok"><Checkmark24Filled /> {rec.by === 'copilot' ? tr('Copilot-assisted') : tr('Decided by you')}</span> : <span className="badge open">{tr('Needs judgement')}</span>}
              </div>
              <p>{trData(t.question)}</p>
              {!compact && <div className="copilot"><Bot24Regular /> <span><strong>{tr('Copilot assist suggests: {label}.', { label: trData(t.options.find((o) => o.id === adv.optionId)!.label) })}</strong> {trData(adv.rationale)}</span></div>}
              {compact && <div className="copilot"><Bot24Regular /> <span>{tr('Suggests:')} <strong>{trData(t.options.find((o) => o.id === adv.optionId)!.label)}</strong></span></div>}
              <ul className="options">
                {t.options.map((o) => {
                  const sel = rec?.optionId === o.id;
                  const sOpt = evaluate(baseline, sc, { ...current, [t.id]: o.id });
                  const sCur = evaluate(baseline, sc, current);
                  return (
                    <li key={o.id} className={sel ? 'opt on' : 'opt'}>
                      <div>
                        <strong>{trData(o.label)}</strong> {adv.optionId === o.id && <span className="badge ai"><Bot24Regular /> {tr('Copilot pick')}</span>}
                        <div className="muted">{trData(o.detail)}</div>
                        {!compact && <div className="muted">{tr('Trade-off: {text}', { text: trData(o.tradeoff) })}</div>}
                        <div className="muted">{tr('Preview: at risk')} <b>{sOpt.atRisk}</b> {fmtDelta(sCur.atRisk, sOpt.atRisk)} · {tr('breaches')} <b>{sOpt.breach}</b> {fmtDelta(sCur.breach, sOpt.breach)} · {tr('blocked')} <b>{sOpt.blocked}</b> {fmtDelta(sCur.blocked, sOpt.blocked)} · {tr('escalations')} <b>{sOpt.escalated}</b> {fmtDelta(sCur.escalated, sOpt.escalated)}</div>
                      </div>
                      <div className="row">
                        <button disabled={!canDecide || sel} onClick={() => decide(t.id, o.id, 'human')}><Person24Regular /> {sel && rec?.by === 'human' ? tr('Chosen') : tr('Choose')}</button>
                        {adv.optionId === o.id && <button disabled={!canDecide || sel} onClick={() => decide(t.id, o.id, 'copilot')}><Bot24Regular /> {tr('Accept')}</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {rec && opt_tasks(t, rec.optionId) > 0 && <p className="muted"><ClipboardTaskListLtr24Regular /> {tr('{n} action task(s) created', { n: opt_tasks(t, rec.optionId) })} <button className="link" onClick={() => setTab('tasks')}>{tr('View in Task list')}</button></p>}
              {rec && <button className="link" disabled={!canDecide} onClick={() => undoDecision(t.id)}><ArrowUndo24Regular /> {tr('Undo decision')}</button>}
            </li>
          );
        })}
      </ol>
      <span hidden><Building24Regular /></span>
    </section>
  );
}
