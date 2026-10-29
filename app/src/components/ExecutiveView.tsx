import { useMemo } from 'react';
import { Warning24Regular, Sparkle24Regular, Money24Regular } from '@fluentui/react-icons';
import { demoById } from '../domain/demo';
import { computeImpact } from '../domain/scenario';
import { activeMitigations } from '../domain/demo';
import { evaluate, scoreImpact, advise } from '../domain/judgement';
import { valueReport } from '../domain/value';
import { activeCustomer } from '../customers';
import { useOps } from '../storage/store';
import { tr } from '../i18n';
import { trData } from '../i18n/data';

/** Three questions an executive asks: what is wrong, what should we do, what does it save. */
export function ExecutiveView() {
  const { baseline, scenarios, activeId, setTab, runDemo } = useOps();
  const c = activeCustomer();
  const sc = scenarios.find((s) => s.id === activeId) ?? null;
  const pack = sc ? demoById(sc.id) : undefined;
  const data = useMemo(() => {
    if (!sc || !pack) return null;
    const none = Object.fromEntries(pack.decisions.map((t) => [t.id, 'none']));
    return {
      before: evaluate(baseline, sc, none),
      now: scoreImpact(baseline, computeImpact(baseline, sc, activeMitigations(sc))),
      advice: pack.decisions.map((t) => ({ t, a: advise(baseline, sc, pack.decisions, t) })),
      value: valueReport(baseline, pack, c.assumptions, c.currency),
    };
  }, [sc, pack, baseline, c]);

  if (!sc || !pack || !data) {
    return (
      <section className="card" aria-label={tr('Executive summary')}>
        <h2>{tr('Executive summary')}</h2>
        <p>{tr('Start with a disruption to see what is wrong, what to do and what it saves.')}</p>
        <button className="primary" onClick={() => runDemo('demo-weather')}>{tr('Run the thunderstorm scenario')}</button>
      </section>
    );
  }
  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: data.value.currency, maximumFractionDigits: 0 });
  return (
    <section className="card" aria-label={tr('Executive summary')}>
      <h2>{trData(sc.name)}</h2>
      <div className="grid3">
        <div><h3><Warning24Regular /> {tr('1. What is wrong')}</h3>
          <p><b>{data.before.breach}</b> {tr('SLA breaches')} · <b>{data.before.atRisk}</b> {tr('flights at risk')} · <b>{data.before.blocked}</b> {tr('blocked tasks')}</p></div>
        <div><h3><Sparkle24Regular /> {tr('2. What to do')}</h3>
          <ul className="plain">{data.advice.map(({ t, a }) => <li key={t.id}>{trData(t.title)}: <b>{trData(t.options.find((o) => o.id === a.optionId)!.label)}</b></li>)}</ul>
          <button onClick={() => setTab('agent')}>{tr('Review the agent proposal')}</button></div>
        <div><h3><Money24Regular /> {tr('3. What it saves')}</h3>
          <p><b>{money.format(data.value.savingPerEvent)}</b> {tr('per event')}; {tr('currently {n} flights at risk after decisions', { n: data.now.atRisk })}</p>
          <button onClick={() => setTab('value')}>{tr('See the value breakdown')}</button>
          <p className="muted">{tr('Simulated results combined with assumptions, not observed results.')}</p></div>
      </div>
    </section>
  );
}
