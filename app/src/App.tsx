import { SEVERITY_ORDER, ROLES } from './domain/types';
import { noFilters } from './domain/view';
import { LENS, OpsProvider, useOps, type Tab } from './storage/store';
import { Board, ExceptionQueue } from './components/Board';
import { DetailPanel, ExceptionDetail, VizPane } from './components/Panels';
import { Diagnostics, OwnerWorkbench, RiskSummary, ScenarioManager, TurnaroundWorkspace } from './components/Workspaces';
import { Tag } from './components/ui';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { ROLE_META, type PanelId, type PanelSpec } from './components/roles';
import { WorkflowPanel } from './components/Workflow';
import { Resources } from './components/Resources';
import {
  Airplane24Regular, AirplaneTakeOff24Regular, Alert24Regular, ArrowReset24Regular, Beaker24Regular, Bug24Regular, DataBarVertical24Regular,
  Eye24Regular, PersonBoard24Regular, PersonProhibited24Regular, ShieldCheckmark24Regular, Timeline24Regular, WeatherMoon24Regular,
  WeatherSunny24Regular, WeatherThunderstorm24Regular, Sparkle24Regular, ClipboardTaskListLtr24Regular, Box24Regular, Gauge24Regular, Clock24Regular, TaskListSquareLtr24Regular, Warning24Regular,
} from '@fluentui/react-icons';
import { DEMO_PACK } from './domain/demo';
import { DecisionQueue } from './components/Decisions';
import { TaskList } from './components/TaskList';
import { LiveBar } from './components/LiveBar';
import { fmt } from './domain/seed';

const TABS: [Tab, string, string, ReactNode][] = [
  ['overview', 'Overview', 'KPIs, map and priorities', <DataBarVertical24Regular key="i" />],
  ['decisions', 'Decisions', 'Judgement tasks for people and Copilot', <Sparkle24Regular key="i" />],
  ['tasks', 'Task list', 'Who does what, by when (5W2H)', <ClipboardTaskListLtr24Regular key="i" />],
  ['turnaround', 'Turnarounds', 'Milestones, tasks and GSE per flight', <Timeline24Regular key="i" />],
  ['exceptions', 'Exceptions', 'Severity, owner and next action', <Alert24Regular key="i" />],
  ['owner', 'Owners', 'Who is accountable for what', <PersonBoard24Regular key="i" />],
  ['scenarios', 'Simulator', 'Build and compare what-if cases', <Beaker24Regular key="i" />],
  ['diagnostics', 'Diagnostics', 'Reset, export and logs', <Bug24Regular key="i" />],
];

const DEMO_ICON: Record<string, ReactNode> = {
  'demo-weather': <WeatherThunderstorm24Regular />,
  'demo-flight-delay': <AirplaneTakeOff24Regular />,
  'demo-no-staff': <PersonProhibited24Regular />,
};

function DemoBar() {
  const { activeId, runDemo, mode } = useOps();
  return (
    <section className="demo" aria-label="Demo scenarios">
      <span className="demo-h"><Beaker24Regular /> <span><strong>Demo scenarios</strong><small>Pick one to see its impact instantly</small></span></span>
      <div className="demo-list" role="group" aria-label="Choose a demo scenario">
        <button className={`demo-card ${!activeId ? 'on' : ''}`} aria-pressed={!activeId} onClick={() => runDemo(null)}>
          <ShieldCheckmark24Regular /><span><strong>Live baseline</strong><small>Observed data, no simulation</small></span>
        </button>
        {DEMO_PACK.map((d) => (
          <button key={d.id} className={`demo-card ${activeId === d.id ? 'on' : ''}`} aria-pressed={activeId === d.id} onClick={() => runDemo(d.id)}>
            {DEMO_ICON[d.id]}<span><strong>{d.title}</strong><small>{d.blurb}</small></span>
          </button>
        ))}
      </div>
      {activeId && <span className="muted">Mode: {mode}</span>}
    </section>
  );
}

function useWallClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

/** Big operational clock: time drives every judgement, so it sits at the top of the screen. */
function ClockBar() {
  const { baseline, timePos, setTimePos, view } = useOps();
  const wall = useWallClock();
  const t = timePos ?? baseline.now;
  const next = baseline.flights
    .map((f) => ({ f, std: f.std + view.delay(f.id) }))
    .filter((x) => x.f.status !== 'Departed' && x.f.status !== 'Cancelled' && x.std >= t)
    .sort((a, b) => a.std - b.std)[0];
  const sgt = wall.toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour12: false });
  return (
    <div className="clock" role="timer" aria-label="Operational time">
      <Clock24Regular />
      <div className="clock-main">
        <span className="clock-time">{fmt(t)}</span>
        <span className="clock-label">{timePos === null ? <b className="live">● LIVE</b> : <b className="replay">REPLAY</b>} operational time</span>
      </div>
      <div className="clock-side">
        <span>SIN local {sgt}</span>
        {next && <span>Next departure <b>{next.f.flightNo}</b> {fmt(next.std)} (in {Math.max(0, next.std - t)} min)</span>}
        {timePos !== null && <button onClick={() => setTimePos(null)}><ArrowReset24Regular /> Back to live {fmt(baseline.now)}</button>}
      </div>
    </div>
  );
}

function Header() {
  const { theme, setTheme, vizMode, setVizMode } = useOps();
  return (
    <header className="top">
      <h1><Airplane24Regular /> <span>AI Operations Control Tower<small>Changi ground handling · prototype</small></span></h1>
      <ClockBar />
      <div className="row">
        <div role="group" aria-label="2D / 3D toggle" className="seg">
          <button aria-pressed={vizMode === '2d'} onClick={() => setVizMode('2d')}>2D</button>
          <button aria-pressed={vizMode === '3d'} onClick={() => setVizMode('3d')}>3D</button>
        </div>
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle theme" title="Toggle light / dark">{theme === 'light' ? <WeatherMoon24Regular /> : <WeatherSunny24Regular />}</button>
      </div>
    </header>
  );
}

function RoleBar() {
  const { role, setRole } = useOps();
  return (
    <section className="roles" aria-label="Role lens">
      <span className="roles-h"><strong>Role lens</strong><small>Layout and priorities change per role</small></span>
      <div className="role-list" role="group" aria-label="Choose a role lens">
        {ROLES.map((r) => (
          <button key={r} className={`role-card ${role === r ? 'on' : ''}`} aria-pressed={role === r} onClick={() => setRole(r)}>
            {ROLE_META[r].icon}<span><strong>{ROLE_META[r].short}</strong><small>{ROLE_META[r].desc}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="card collapsible" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary><strong>{title}</strong> <small>secondary for this role: expand when needed</small></summary>
      {open && children}
    </details>
  );
}

const PANEL_TITLE: Record<PanelId, string> = {
  workflow: 'Response workflow', kpi: 'Key indicators', decisions: 'Decision queue', exceptions: 'Exceptions', board: 'Turnaround board',
  viz: 'Situational view (2D / 3D)', risk: 'Risk by pier / airline', resources: 'Crew & equipment', detail: 'Detail', owner: 'Owner workbench', tasks: 'Task list',
};

function renderPanel(p: PanelSpec): ReactNode {
  switch (p.id) {
    case 'workflow': return <WorkflowPanel />;
    case 'kpi': return <Kpis />;
    case 'decisions': return <DecisionQueue compact />;
    case 'exceptions': return <ExceptionQueue compact defaultView={p.view === 'pipeline' ? 'pipeline' : 'list'} />;
    case 'board': return <Board defaultView={p.view === 'gantt' || p.view === 'pipeline' ? p.view : 'table'} />;
    case 'viz': return <VizPane />;
    case 'risk': return <RiskSummary />;
    case 'resources': return <Resources />;
    case 'detail': return <><DetailPanel /><ExceptionDetail /></>;
    case 'owner': return <OwnerWorkbench />;
    case 'tasks': return <TaskList compact />;
  }
}

function RoleLayout() {
  const { role } = useOps();
  const meta = ROLE_META[role];
  return (
    <>
      <p className="focus" role="note"><Eye24Regular /> <span><strong>{role}:</strong> {meta.focus} <small>Panels are ordered by importance for this role.</small></span></p>
      <main className="role-grid">
        {meta.layout.map((p, i) => (
          <div key={`${role}-${p.id}-${i}`} className={p.span === 2 ? 'span2' : ''} data-panel={p.id}>
            <span className="rank" aria-hidden="true">{i + 1}</span>
            {p.secondary ? <Collapsible title={PANEL_TITLE[p.id]}>{renderPanel(p)}</Collapsible> : renderPanel(p)}
          </div>
        ))}
      </main>
    </>
  );
}
function Banner() {
  const { mode, activeId, scenarios, activate, notice, setNotice, role } = useOps();
  const sc = scenarios.find((s) => s.id === activeId);
  return (
    <>
      <p className="safety" role="note"><Eye24Regular /> View-only prototype · simulated data · no operational execution or write-back. {LENS[role].blurb}.</p>
      {sc && <div className="scenario-banner" role="status"><Tag simulated /> Scenario “{sc.name}” — mode: <strong>{mode}</strong> <button onClick={() => activate(null)}><ArrowReset24Regular /> Return to Baseline</button></div>}
      {notice && <div className="notice" role="status">{notice} <button onClick={() => setNotice('')}>Dismiss</button></div>}
    </>
  );
}

const KPI_ICON: Record<string, [ReactNode, string]> = {
  volume: [<Airplane24Regular key="i" />, 'Flights in current scope'],
  risk: [<Warning24Regular key="i" />, 'Turnarounds at risk or breached'],
  exceptions: [<Alert24Regular key="i" />, 'Open, unresolved exceptions'],
  sla: [<Gauge24Regular key="i" />, 'Turnarounds with SLA risk'],
  milestones: [<Clock24Regular key="i" />, 'Forecast later than plan'],
  gse: [<Box24Regular key="i" />, 'Equipment ready / in use'],
  actions: [<TaskListSquareLtr24Regular key="i" />, 'Actions awaiting owners'],
};

function Kpis() {
  const { view, kpiKey, setKpi } = useOps();
  const base = view.kpis();
  return (
    <section className="kpis" aria-label="Key performance indicators">
      {base.map((k) => (
        <button key={k.key} className={kpiKey === k.key ? 'kpi on' : 'kpi'} aria-pressed={kpiKey === k.key} disabled={!k.ids.length} onClick={() => setKpi(kpiKey === k.key ? null : k.key)} title="Drill through to the contributing flights">
          <span className="ico">{KPI_ICON[k.key][0]}</span><span className="v">{k.value}</span><span className="kl">{k.label}</span><small>{KPI_ICON[k.key][1]}</small>
        </button>
      ))}
    </section>
  );
}


function TimeBar() {
  const { timePos, setTimePos, baseline } = useOps();
  const now = baseline.now;
  return (
    <section className="timebar" aria-label="Operational time position">
      <Clock24Regular />
      <label>Time position
        <input type="range" min={now - 60} max={now + 180} step={5} value={timePos ?? now} aria-valuetext={fmt(timePos ?? now)} onChange={(e) => setTimePos(Number(e.target.value))} />
      </label>
      <strong>{timePos === null ? `Live · ${fmt(now)}` : fmt(timePos)}</strong>
      <button onClick={() => setTimePos(null)} disabled={timePos === null}><ArrowReset24Regular /> Live</button>
      <small>{timePos === null ? 'Showing all flights in scope' : 'Showing flights on stand at this time (all views)'}</small>
    </section>
  );
}

function FilterBar() {
  const { filters, setFilters, baseline, kpiKey, setKpi } = useOps();
  const sel = (k: keyof typeof filters, label: string, opts: [string, string][]) => (
    <label>{label} <select value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}><option value="">All</option>{opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
  );
  return (
    <section className="filters" aria-label="Global filters">
      {sel('bu', 'BU', baseline.bus.map((b) => [b.id, b.name]))}
      {sel('pier', 'Pier', ['A', 'B', 'C'].map((p) => [p, p]))}
      {sel('airline', 'Airline', baseline.airlines.map((a) => [a.id, a.name]))}
      {sel('severity', 'Severity', SEVERITY_ORDER.map((s) => [s, s]))}
      {sel('owner', 'Owner', [['unassigned', 'Unassigned'], ...baseline.stakeholders.map((s): [string, string] => [s.id, s.displayName])])}
      {sel('window', 'Time window', [['60', 'Next 60 min'], ['120', 'Next 120 min']])}
      <button onClick={() => { setFilters(noFilters); setKpi(null); }}>Clear filters{kpiKey ? ' & KPI drill' : ''}</button>
    </section>
  );
}

function Main() {
  const { tab, setTab } = useOps();
  const plain = tab !== 'overview' && tab !== 'scenarios' && tab !== 'diagnostics';
  return (
    <>
      <nav className="tabs" role="tablist" aria-label="Views">
        {TABS.map(([k, l, d, ic]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} title={d}>{ic}<span><strong>{l}</strong><small>{d}</small></span></button>)}
      </nav>
      {tab === 'overview' && <><TimeBar /><FilterBar /><RoleLayout /></>}
      {plain && <><Kpis /><TimeBar /><FilterBar /></>}
      {tab !== 'overview' && <main className={tab === 'turnaround' ? 'grid-main' : 'single'}>
        {tab === 'tasks' && <><TaskList /><WorkflowPanel /></>}
        {tab === 'decisions' && <><WorkflowPanel /><DecisionQueue /><VizPane /></>}
        {tab === 'turnaround' && <><div className="col"><Board /><TurnaroundWorkspace /></div><div className="col"><VizPane /><DetailPanel /></div></>}
        {tab === 'exceptions' && <><div className="col"><ExceptionQueue /></div><div className="col"><ExceptionDetail /><DetailPanel /></div></>}
        {tab === 'owner' && <OwnerWorkbench />}
        {tab === 'scenarios' && <><ScenarioManager /><VizPane /></>}
        {tab === 'diagnostics' && <Diagnostics />}
      </main>}
    </>
  );
}
class Boundary extends Component<{ children: ReactNode }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error('render-error', err.message); }
  render() { return this.state.err ? <div role="alert" className="notice">Something failed to render: {this.state.err.message}. Reload or use Diagnostics → Reset.</div> : this.props.children; }
}

export default function App() {
  return (
    <Boundary>
      <OpsProvider><a href="#main" className="skip">Skip to content</a><Header /><RoleBar /><DemoBar /><Banner /><LiveBar /><div id="main"><Main /></div></OpsProvider>
    </Boundary>
  );
}
