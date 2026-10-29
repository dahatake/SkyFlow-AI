import { useEffect, useState } from 'react';
import { Pause24Regular, Play24Regular, ArrowReset24Regular } from '@fluentui/react-icons';
import { fmt } from '../domain/seed';
import { useOps } from '../storage/store';
import { tr } from '../i18n';

const SPEEDS: [number, string, string][] = [[1, '×1', 'update every 1 min'], [15, '×15', 'every 4 s (demo)'], [60, '×60', 'every 1 s (demo)']];

/** Live feed status: shows that data refreshes every operational minute, with a ticker of what just changed. */
export function LiveBar() {
  const { live, baseline } = useOps();
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const period = 60000 / live.speed;
  const remain = live.paused ? 0 : Math.max(0, Math.ceil((live.lastTickAt + period - Date.now()) / 1000));
  const recent = live.feed.slice(0, 6);
  return (
    <section className="livebar" aria-label={tr('Live data feed')}>
      <div className="live-head">
        <span className={live.paused ? 'dot paused' : 'dot'} aria-hidden="true" />
        <strong>{live.paused ? tr('Live feed paused') : tr('Live feed')}</strong>
                <span className="muted">{tr('updated to')} <b>{fmt(baseline.now)}</b> · {live.paused ? tr('paused') : tr('next update in {n}s', { n: remain })} · {tr(live.tick === 1 ? '{n} update since start' : '{n} updates since start', { n: live.tick })}</span>
        <div className="row">
          <button onClick={() => live.setPaused(!live.paused)}           aria-label={live.paused ? tr('Resume live feed') : tr('Pause live feed')}>{live.paused ? <Play24Regular /> : <Pause24Regular />}{live.paused ? tr('Resume') : tr('Pause')}</button>
                    <div role="group" aria-label={tr('Feed speed')} className="seg small">
                      {SPEEDS.map(([n, l, d]) => <button key={n} aria-pressed={live.speed === n} title={tr(d)} onClick={() => live.setSpeed(n)}>{l}</button>)}
          </div>
                    <button onClick={live.restart} title={tr('Restart the simulated feed from the current Changi time')}><ArrowReset24Regular /> {tr('Restart feed')}</button>
        </div>
      </div>
      <ul className="ticker" aria-live="polite">
        {recent.length ? recent.map((e, i) => <li key={`${e.at}-${i}-${e.text}`}><b>{fmt(e.at)}</b> {e.text}</li>) : <li className="muted">{tr('Waiting for the first update… (feed refreshes every minute; use ×15 for a faster demo)')}</li>}
      </ul>
    </section>
  );
}
