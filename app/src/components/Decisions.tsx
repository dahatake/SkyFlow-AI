import { useMemo, type ReactNode } from 'react';
import {
  Bot24Regular, Checkmark24Filled, Person24Regular, ArrowUndo24Regular, Building24Regular, People24Regular, ArrowSwap24Regular, Wrench24Regular, CalendarClock24Regular, Sparkle24Regular,
} from '@fluentui/react-icons';
import { computeImpact } from '../domain/scenario';
import { activeMitigations, demoById, type DecisionTask } from '../domain/demo';
import { advise, evaluate, scoreImpact, type Score } from '../domain/judgement';
import { useOps } from '../storage/store';
import { Tag } from './ui';

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
  const cells: [string, keyof Score][] = [['Flights at risk', 'atRisk'], ['Breaches', 'breach'], ['Blocked tasks', 'blocked'], ['Escalations', 'escalated']];
  return (
    <div className="score">
      <strong>{label}</strong>
      {cells.map(([l, k]) => <span key={k}>{l}: <b>{s[k]}</b>{r && <> {fmtDelta(r[k], s[k])}</>}</span>)}
    </div>
  );
}

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
      <section className="card" aria-label="Decision queue">
        <h2><Sparkle24Regular /> Decision queue</h2>
        <p className="muted">Pick a demo scenario at the top to get judgement tasks. People and Copilot assist can change staff, crew, facility and gate decisions and the simulator shows the result.</p>
      </section>
    );
  }
  const decided = pack.decisions.filter((t) => sc.decisions?.[t.id]).length;
  const canDecide = role !== 'Observer';
  return (
    <section className="card decisions" aria-label="Decision queue">
      <div className="row between">
        <h2><Sparkle24Regular /> Decision queue <small>{decided}/{pack.decisions.length} decided · {sc.name}</small></h2>
        <div className="row">
          {compact && <button onClick={() => setTab('decisions')}>Open full view</button>}
          <button className="primary" disabled={!canDecide || decided === pack.decisions.length} onClick={copilotAll} title="Accept Copilot assist suggestion for every open task"><Bot24Regular /> Let Copilot assist all</button>
        </div>
      </div>
      <p className="muted">All decisions change the simulated overlay only. Copilot assist is an advisory rule-based recommendation computed by re-running the scenario engine for each option; a person always confirms. {!canDecide && 'Observer lens is read-only.'}</p>

      <div className="scores" aria-label="Outcome so far">
        <ScoreStrip label="Normal day" s={calc.normal} />
        <ScoreStrip label="Disruption, no decisions" s={calc.before} vs={calc.normal} />
        <ScoreStrip label="With your decisions" s={calc.current} vs={calc.before} />
        <p className="muted">Green = improvement vs the row above. <Tag simulated /> {view.simulated ? '' : 'Switch to Scenario or Difference mode to see these effects on the board and maps.'}</p>
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
                <span><strong>{t.title}</strong><small>{t.area} · owner: {t.owner}</small></span>
                {rec ? <span className="badge ok"><Checkmark24Filled /> {rec.by === 'copilot' ? 'Copilot-assisted' : 'Decided by you'}</span> : <span className="badge open">Needs judgement</span>}
              </div>
              <p>{t.question}</p>
              {!compact && <div className="copilot"><Bot24Regular /> <span><strong>Copilot assist suggests: {t.options.find((o) => o.id === adv.optionId)!.label}.</strong> {adv.rationale}</span></div>}
              {compact && <div className="copilot"><Bot24Regular /> <span>Suggests: <strong>{t.options.find((o) => o.id === adv.optionId)!.label}</strong></span></div>}
              <ul className="options">
                {t.options.map((o) => {
                  const sel = rec?.optionId === o.id;
                  const sOpt = evaluate(baseline, sc, { ...current, [t.id]: o.id });
                  const sCur = evaluate(baseline, sc, current);
                  return (
                    <li key={o.id} className={sel ? 'opt on' : 'opt'}>
                      <div>
                        <strong>{o.label}</strong> {adv.optionId === o.id && <span className="badge ai"><Bot24Regular /> Copilot pick</span>}
                        <div className="muted">{o.detail}</div>
                        {!compact && <div className="muted">Trade-off: {o.tradeoff}</div>}
                        <div className="muted">Preview: at risk <b>{sOpt.atRisk}</b> {fmtDelta(sCur.atRisk, sOpt.atRisk)} · breaches <b>{sOpt.breach}</b> {fmtDelta(sCur.breach, sOpt.breach)} · blocked <b>{sOpt.blocked}</b> {fmtDelta(sCur.blocked, sOpt.blocked)} · escalations <b>{sOpt.escalated}</b> {fmtDelta(sCur.escalated, sOpt.escalated)}</div>
                      </div>
                      <div className="row">
                        <button disabled={!canDecide || sel} onClick={() => decide(t.id, o.id, 'human')}><Person24Regular /> {sel && rec?.by === 'human' ? 'Chosen' : 'Choose'}</button>
                        {adv.optionId === o.id && <button disabled={!canDecide || sel} onClick={() => decide(t.id, o.id, 'copilot')}><Bot24Regular /> Accept</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {rec && <button className="link" disabled={!canDecide} onClick={() => undoDecision(t.id)}><ArrowUndo24Regular /> Undo decision</button>}
            </li>
          );
        })}
      </ol>
      <span hidden><Building24Regular /></span>
    </section>
  );
}
