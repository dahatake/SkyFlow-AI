import { PeopleTeam24Regular, VehicleTruck24Regular } from '@fluentui/react-icons';
import { useOps } from '../storage/store';
import { Tag } from './ui';

/** BU crew capacity and GSE availability: the BU Ops / Ramp Lead working view. */
export function Resources() {
  const { view } = useOps();
  const b = view.b;
  const types = [...new Set(b.assets.map((a) => a.type))];
  return (
    <section className="card" aria-label="Crew capacity and equipment">
      <h2><PeopleTeam24Regular /> Crew capacity &amp; equipment {view.simulated && <Tag simulated />}</h2>
      <h3>Crew by business unit</h3>
      <ul className="cap">
        {b.staff.map((s) => {
          const p = view.impact.capacityPressure[s.id];
          const base = s.engaged / s.available;
          const pressure = p ?? base;
          const bu = b.bus.find((x) => x.id === s.buId)!;
          const status = pressure > 1.3 ? 'Blocked' : pressure > 1 ? 'AtRisk' : pressure > 0.85 ? 'Watch' : 'Normal';
          return (
            <li key={s.id}>
              <span>{bu.name} · {s.skillGroup}</span>
              <meter min={0} max={2} low={0.85} high={1} optimum={0.6} value={Math.min(2, pressure)} aria-label={`${bu.name} ${s.skillGroup} pressure ${pressure.toFixed(2)}`} />
              <span>{s.engaged}/{s.available} engaged · pressure <b>{pressure.toFixed(2)}</b> ({status}) {p !== undefined && <Tag simulated />}</span>
            </li>
          );
        })}
      </ul>
      <h3><VehicleTruck24Regular /> Equipment (GSE)</h3>
      <table>
        <thead><tr><th>Type</th><th>Available</th><th>Reserved</th><th>Engaged</th><th>Unavailable</th></tr></thead>
        <tbody>
          {types.map((t) => {
            const c = (st: string) => b.assets.filter((a) => a.type === t && view.assetState(a.id) === st).length;
            const lost = b.assets.filter((a) => a.type === t && view.impact.assetState[a.id]).length;
            return <tr key={t}><td>{t}</td><td>{c('Available')}</td><td>{c('Reserved')}</td><td>{c('Engaged')}</td><td className={c('Unavailable') ? 'bad' : ''}>{c('Unavailable')} {lost > 0 && <Tag simulated />}</td></tr>;
          })}
        </tbody>
      </table>
    </section>
  );
}
