import { useEffect, useState } from 'react';
import { PlayCircle24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import { useOps, type Tab } from '../storage/store';
import { tr } from '../i18n';

interface Step { title: string; say: string; tab: Tab; run?: 'start' | 'copilot' }
const STEPS: Step[] = [
  { title: '1. The problem', say: 'A lightning stoppage delays arrivals and creates gate conflicts. Today this is found through radios and chat.', tab: 'executive', run: 'start' },
  { title: '2. What is wrong', say: 'Every conflict is ranked by SLA exposure in one view.', tab: 'overview' },
  { title: '3. The agent proposes', say: 'Detect, Triage and Resolve agents compare options using the scenario engine.', tab: 'agent' },
  { title: '4. A person approves', say: 'Nothing changes until the duty manager approves.', tab: 'decisions', run: 'copilot' },
  { title: '5. Who does what', say: 'Each decision becomes owned 5W2H tasks.', tab: 'tasks' },
  { title: '6. What it saves', say: 'Before and after, with the assumptions visible.', tab: 'value' },
];

/** Guided demo: ?demo=1 opens it. Pair with ?clock=2027-01-11T08:00:00+08:00 for a reproducible run. */
export function DemoGuide() {
  const { setTab, runDemo, copilotAll } = useOps();
  const [open, setOpen] = useState(() => typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo'));
  const [n, setN] = useState(0);
  useEffect(() => { if (open) { const s = STEPS[n]; setTab(s.tab); if (s.run === 'start') runDemo('demo-weather'); } }, [open, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!open) { setRect(null); return; }
    const measure = () => {
      const el = document.querySelector<HTMLElement>('main section.card, main .card, main');
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: 'nearest' });
      setRect(el.getBoundingClientRect());
    };
    const t = window.setInterval(measure, 300);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { clearInterval(t); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [open, n]);
  if (!open) return <button className="demo-start" onClick={() => { setN(0); setOpen(true); }}><PlayCircle24Regular /> {tr('Guided demo')}</button>;
  const s = STEPS[n];
  return (
    <>
    {rect && <div className="demo-spot" aria-hidden="true" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />}
    <aside className="demo-guide" aria-label={tr('Guided demo')}>
      <button aria-label={tr('Close')} onClick={() => setOpen(false)}><Dismiss24Regular /></button>
      <strong>{tr(s.title)}</strong>
      <p>{tr(s.say)}</p>
      <div className="row">
        <button disabled={n === 0} onClick={() => setN(n - 1)}>{tr('Back')}</button>
        {s.run === 'copilot' && <button onClick={copilotAll}>{tr('Approve agent picks')}</button>}
        <button className="primary" disabled={n === STEPS.length - 1} onClick={() => setN(n + 1)}>{tr('Next')}</button>
        <span className="muted">{n + 1}/{STEPS.length}</span>
      </div>
    </aside>
    </>
  );
}
