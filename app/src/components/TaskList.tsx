import { useMemo, useState } from 'react';
import { CheckmarkCircle24Filled, ClipboardTaskListLtr24Regular, Bot24Regular, Person24Regular, Warning24Regular } from '@fluentui/react-icons';
import { demoById } from '../domain/demo';
import { fmt } from '../domain/seed';
import { deriveTasks, type ActionTask } from '../domain/tasks';
import type { TaskStatus } from '../domain/types';
import { useOps } from '../storage/store';
import { getLang, tr } from '../i18n';
import { trData } from '../i18n/data';
import { ViewSwitch, type ViewMode } from './Views';

const PRI: Record<number, [string, string]> = { 1: ['P1 High', '#a4262c'], 2: ['P2 Medium', '#d83b01'], 3: ['P3 Low', '#107c10'] };
const NEXT: Record<TaskStatus, TaskStatus | null> = { Todo: 'Doing', Doing: 'Done', Done: null };
const NEXT_LABEL: Record<TaskStatus, string> = { Todo: 'Start', Doing: 'Mark done', Done: '' };

function PriorityTag({ p }: { p: number }) {
  return <span className="badge" style={{ borderColor: PRI[p][1], color: PRI[p][1] }}><span aria-hidden="true">{p === 1 ? '▲' : p === 2 ? '●' : '○'}</span> {tr(PRI[p][0])}</span>;
}

export function TaskList({ compact = false }: { compact?: boolean }) {
  const { scenarios, activeId, baseline, role, setTaskStatus, setTab, view, select, selection, live } = useOps();
  const [mode, setMode] = useState<ViewMode>(compact ? 'list' : 'list');
  const [owner, setOwner] = useState('');
  const [pri, setPri] = useState('');
  const [st, setSt] = useState('');
  const sc = scenarios.find((s) => s.id === activeId) ?? null;
  const pack = sc && demoById(sc.id);
  const now = baseline.now;
  const lang = getLang();
  const all = useMemo(() => deriveTasks(sc, now), [sc, now, lang]);
  const tasks = all.filter((t) => (!owner || t.who === owner) && (!pri || String(t.priority) === pri) && (!st || t.status === st));
  const can = role !== 'Observer';
  const overdue = (t: ActionTask) => t.status !== 'Done' && now > t.when.due;
  const count = (s: TaskStatus) => all.filter((t) => t.status === s).length;
  const owners = [...new Set(all.map((t) => t.who))];
  void live;

  const action = (t: ActionTask) => {
    const n = NEXT[t.status];
    return n ? <button className={t.status === 'Todo' ? '' : 'primary'} disabled={!can} onClick={(e) => { e.stopPropagation(); setTaskStatus(t.id, n); }}>    {NEXT_LABEL[t.status] && tr(NEXT_LABEL[t.status])}</button> : <span className="done-mark"><CheckmarkCircle24Filled /> {tr('Done')}</span>;
  };

  if (!all.length) {
    return (
          <section className="card" aria-label={tr('Task list')}>
            <h2><ClipboardTaskListLtr24Regular /> {tr('Task list')}</h2>
            <p className="muted">{pack ? tr('No tasks yet. Decide on the judgement tasks of "{title}" (you or Copilot assist) and the chosen actions appear here as 5W2H tasks.', { title: trData(pack.title) }) : tr('Pick a demo scenario, then decide on its judgement tasks. Chosen actions become tasks here.')}</p>
            {pack && <button className="primary" onClick={() => setTab('decisions')}>{tr('Go to Decision queue')}</button>}
      </section>
    );
  }

  const shown = compact ? tasks.slice(0, 5) : tasks;
  return (
        <section className="card tasklist" aria-label={tr('Task list')}>
      <div className="row between">
            <h2><ClipboardTaskListLtr24Regular /> {tr('Task list')} <small>{tr('decisions turned into 5W2H action tasks · {name}', { name: trData(sc!.name) })}</small></h2>
        <div className="row">
              {compact && <button onClick={() => setTab('tasks')}>{tr('Open full view')}</button>}
          <ViewSwitch value={mode} onChange={setMode} modes={['list', 'gantt', 'pipeline']} />
        </div>
      </div>
          <div className="chips-row" aria-label={tr('Task summary')}>
            <span className="chip">{tr('Total')} <b>{all.length}</b></span>
            <span className="chip">{tr('To do')} <b>{count('Todo')}</b></span>
            <span className="chip">{tr('Doing')} <b>{count('Doing')}</b></span>
            <span className="chip good">{tr('Done')} <b>{count('Done')}</b></span>
            <span className={`chip ${all.some(overdue) ? 'bad' : ''}`}>{tr('Overdue')} <b>{all.filter(overdue).length}</b></span>
            <progress max={all.length} value={count('Done')} aria-label={tr('Tasks done')} />
      </div>
      {!compact && (
            <div className="filters inline" aria-label={tr('Task filters')}>
              <label>{tr('Who')} <select value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">{tr('Everyone')}</option>{owners.map((o) => <option key={o} value={o}>{view.ownerName(o)}</option>)}</select></label>
              <label>{tr('Priority')} <select value={pri} onChange={(e) => setPri(e.target.value)}><option value="">{tr('All')}</option><option value="1">{tr('P1 High')}</option><option value="2">{tr('P2 Medium')}</option><option value="3">{tr('P3 Low')}</option></select></label>
              <label>{tr('Status')} <select value={st} onChange={(e) => setSt(e.target.value)}><option value="">{tr('All')}</option><option value="Todo">{tr('Todo')}</option><option value="Doing">{tr('Doing')}</option><option value="Done">{tr('Done')}</option></select></label>
        </div>
      )}

      {mode === 'list' && (
        <ul className="tasks5">
          {shown.map((t) => (
            <li key={t.id} className={`t5 p${t.priority} ${t.status.toLowerCase()} ${overdue(t) ? 'late' : ''} ${selection?.id === t.id ? 'sel' : ''}`}>
              <div className="t5-head">
                <PriorityTag p={t.priority} />
                <strong>{t.what}</strong>
                {overdue(t) && <span className="badge" style={{ borderColor: '#a4262c', color: '#a4262c' }}><Warning24Regular /> {tr('Overdue')}</span>}
                <span className="by" title={t.by === 'copilot' ? tr('Decided with Copilot assist') : tr('Decided by a person')}>{t.by === 'copilot' ? <Bot24Regular /> : <Person24Regular />}</span>
                <span className="t5-status">{t.status === 'Todo' ? tr('To do') : tr(t.status)}</span>
                {action(t)}
              </div>
              <div className="w2h">
                <div><small>{tr('WHO')}</small><span>{view.ownerName(t.who)}</span></div>
                <div><small>{tr('WHEN')}</small><span>{fmt(t.when.start)}–{fmt(t.when.due)}</span></div>
                <div><small>{tr('WHERE')}</small><span>{t.where}</span></div>
                {!compact && <div><small>{tr('HOW')}</small><span>{t.how}</span></div>}
                {!compact && <div><small>{tr('HOW MUCH')}</small><span>{t.howMuch}</span></div>}
                {!compact && <div className="why"><small>{tr('WHY')}</small><span>{t.why}</span></div>}
              </div>
              <progress max={100} value={t.progress} aria-label={tr('{task} progress', { task: t.what })} />
            </li>
          ))}
        </ul>
      )}

      {mode === 'gantt' && <TaskGantt tasks={tasks} now={now} onSelect={(id) => select({ kind: 'task', id })} />}

      {mode === 'pipeline' && (
        <div className="pipeline three" role="group" aria-label={tr('Task board')}>
          {(['Todo', 'Doing', 'Done'] as TaskStatus[]).map((s) => (
            <section key={s} className="p-col" aria-label={`${s === 'Todo' ? tr('To do') : tr(s)}: ${tasks.filter((t) => t.status === s).length}`}>
              <header><strong>{s === 'Todo' ? tr('To do') : tr(s)}</strong><span className="count">{tasks.filter((t) => t.status === s).length}</span></header>
              <ul>
                {tasks.filter((t) => t.status === s).map((t) => (
                  <li key={t.id} className="p-card"><div><PriorityTag p={t.priority} /></div><strong>{t.what}</strong><small>{view.ownerName(t.who)} · {tr('due {time}', { time: fmt(t.when.due) })}{overdue(t) ? ` · ${tr('overdue')}` : ''}</small>{action(t)}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {compact && tasks.length > 5 && <p className="muted">{tr('+{n} more in the full Task list', { n: tasks.length - 5 })}</p>}
      {!tasks.length && <p className="muted">{tr('No tasks match the filters.')}</p>}
    </section>
  );
}

/** Project-style Gantt grouped by owner, bars coloured by priority with progress fill. */
function TaskGantt({ tasks, now, onSelect }: { tasks: ActionTask[]; now: number; onSelect(id: string): void }) {
  const { view } = useOps();
  const t0 = Math.min(now - 10, ...tasks.map((t) => t.when.start)) - 5;
  const t1 = Math.max(now + 60, ...tasks.map((t) => t.when.due)) + 10;
  const pct = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  const ticks: number[] = [];
  for (let t = Math.ceil(t0 / 15) * 15; t <= t1; t += 15) ticks.push(t);
  const byOwner = new Map<string, ActionTask[]>();
  tasks.forEach((t) => byOwner.set(t.who, [...(byOwner.get(t.who) ?? []), t]));
  return (
    <div className="gantt tgantt" role="table" aria-label={tr('Task Gantt chart')}>
      <div className="g-head"><span>{tr('Task')}</span><div className="track">{ticks.map((t) => <span key={t} className="tick" style={{ left: `${pct(t)}%` }}>{fmt(t)}</span>)}</div></div>
      <div className="g-body">
        {[...byOwner].map(([o, list]) => (
          <div key={o}>
            <div className="g-group">{view.ownerName(o)}             <small>{tr('{n} task(s)', { n: list.length })}</small></div>
            {list.map((t) => (
                          <div key={t.id} role="row" tabIndex={0} className="g-row" onClick={() => onSelect(t.id)} aria-label={tr('{task} {status} priority {p}', { task: t.what, status: t.status === 'Todo' ? tr('To do') : tr(t.status), p: t.priority })}>
                <span className="g-label" title={t.what}>{t.what}</span>
                <div className="track">
                  <div className="bar" style={{ left: `${pct(t.when.start)}%`, width: `${pct(t.when.due) - pct(t.when.start)}%`, background: PRI[t.priority][1], opacity: t.status === 'Done' ? 0.55 : 1 }} title={`${fmt(t.when.start)}–${fmt(t.when.due)} · ${t.status === 'Todo' ? tr('To do') : tr(t.status)}`}>
                    <span className="fill" style={{ width: `${t.progress}%` }} />
                    <span className="bar-t">{t.status === 'Done' ? '✓' : `P${t.priority}`}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="now-line" style={{ left: `calc(130px + (100% - 130px) * ${(now - t0) / (t1 - t0)})` }}>        <span>{tr('Now {time}', { time: fmt(now) })}</span></div>
      </div>
              <p className="muted">{tr('Bars show planned start to due time. Lighter fill = progress. Colour and the P1-P3 label both encode priority.')}</p>
    </div>
  );
}
