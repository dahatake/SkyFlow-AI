import { useMemo } from 'react';
import { Money24Regular } from '@fluentui/react-icons';
import { DEMO_PACK } from '../domain/demo';
import { valueReport } from '../domain/value';
import { activeCustomer } from '../customers';
import { useOps } from '../storage/store';
import { tr } from '../i18n';
import { trData } from '../i18n/data';

const money = (n: number, cur: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);

/** Before/after per disruption, derived from the engine and the customer assumptions file. */
export function ValueView() {
  const { baseline } = useOps();
  const c = activeCustomer();
  const reports = useMemo(() => DEMO_PACK.map((p) => ({ p, r: valueReport(baseline, p, c.assumptions, c.currency) })), [baseline, c]);
  return (
    <section className="card" aria-label={tr('Value')}>
      <h2><Money24Regular /> {tr('Value: without vs with decisions')}</h2>
      <p className="warn">{tr('Simulated results combined with assumptions, not observed results.')} {c.assumptions.source}</p>
      {reports.map(({ p, r }) => (
        <div key={p.id}>
          <h3>{trData(p.title)}</h3>
          <table>
            <thead><tr><th>{tr('Measure')}</th><th>{tr('Without decisions')}</th><th>{tr('With decisions')}</th><th>{tr('Improvement')}</th></tr></thead>
            <tbody>{r.rows.map((x) => <tr key={x.label}><td>{tr(x.label)}</td><td>{x.before} {x.unit === 'min' ? tr('min') : ''}</td><td>{x.after} {x.unit === 'min' ? tr('min') : ''}</td><td><b>{x.delta}</b></td></tr>)}</tbody>
          </table>
          <p><strong>{tr('Estimated saving')}</strong>: {money(r.savingPerEvent, r.currency)} {tr('per event')} · {money(r.savingPerMonth, r.currency)} {tr('per month at {n} events', { n: c.assumptions.disruptionsPerMonth })}</p>
        </div>
      ))}
      <details><summary>{tr('How it is calculated')}</summary>
        <p className="muted">{tr('Saving = avoided SLA breaches x penalty + avoided blocked tasks x cost + avoided delay minutes x cost per minute. Rates come from customers/{id}/customer.json.', { id: c.id })}</p>
        <ul className="plain">
          <li>{tr('Cost per delay minute')}: {money(c.assumptions.costPerDelayMinute, c.currency)}</li>
          <li>{tr('SLA breach penalty')}: {money(c.assumptions.slaBreachPenalty, c.currency)}</li>
          <li>{tr('Blocked task cost')}: {money(c.assumptions.blockedTaskCost, c.currency)}</li>
        </ul>
      </details>
    </section>
  );
}
