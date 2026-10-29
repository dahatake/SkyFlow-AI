import { createContext, useRef, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { computeImpact, validateParams } from '../domain/scenario';
import { activeMitigations, demoById } from '../domain/demo';
import { advise } from '../domain/judgement';
import { applyLive, diffLive } from '../domain/live';
import { DEMO_PACK } from '../domain/demo';
import { deepFreeze } from '../domain/seed';
import { now as clockNow, nowDate } from '../domain/clock';
import { overlayPlan, type OptPlan } from '../domain/optimizer';
import { getProvider } from '../data/provider';
import { noFilters, OpsView, type Filters, type Selection, type SimMode } from '../domain/view';
import type { AuditEvent, Baseline, DiagEvent, ExceptionState, RoleType, Scenario, TaskStatus } from '../domain/types';
import * as repo from '../storage/repo';
import { useGpsTracker, type GpsState } from './gpsTracker';
import { getLang, tr } from '../i18n';

export type WfMap = Record<string, { status: ExceptionState; ownerId?: string; ackAt?: number; actAt?: number }>;
export type Tab = 'overview' | 'kpi' | 'decisions' | 'tasks' | 'turnaround' | 'exceptions' | 'owner' | 'scenarios' | 'optimize' | 'planning' | 'diagnostics';

export const LENS: Record<RoleType, { tab: Tab; filters: Partial<Filters>; canSimulate: boolean; blurb: string }> = {
  'Control Tower Lead': { tab: 'overview', filters: {}, canSimulate: true, blurb: 'Airport-wide risk, SLA exposure and ownership' },
  'SIOC Duty Manager': { tab: 'overview', filters: {}, canSimulate: true, blurb: 'Live turnarounds, exceptions and dependencies' },
  'BU Ops Manager': { tab: 'overview', filters: { bu: 'bu-ramp' }, canSimulate: true, blurb: 'BU workload, capacity and SLA risk' },
  'Ramp Lead': { tab: 'overview', filters: { pier: 'A' }, canSimulate: false, blurb: 'Pier/stand view and next actions' },
  'Action Owner': { tab: 'overview', filters: { owner: 'u-own1' }, canSimulate: false, blurb: 'What is assigned to me and what depends on it' },
  Observer: { tab: 'overview', filters: {}, canSimulate: false, blurb: 'Read-only summary and scenario comparison' },
};

interface Ctx {
  ready: boolean; notice: string; setNotice(s: string): void;
  baseline: Baseline; view: OpsView; scenarios: Scenario[]; activeId: string | null; mode: SimMode;
  filters: Filters; selection: Selection | null; related: Set<string>; kpiKey: string | null; timePos: number | null; setTimePos(t: number | null): void; live: { tick: number; speed: number; paused: boolean; lastTickAt: number; feed: { at: number; text: string }[]; setSpeed(n: number): void; setPaused(p: boolean): void; restart(): void }; setTaskStatus(id: string, st: TaskStatus): void; wf: WfMap; advance(ids: string[], to: ExceptionState, ownerId?: string | null | ((id: string) => string | null | undefined)): void;
  role: RoleType; tab: Tab; vizMode: '2d' | '3d'; layers: Record<string, boolean>; theme: 'light' | 'dark'; audit: AuditEvent[]; diag: DiagEvent[];
  setFilters(f: Filters): void; select(s: Selection | null): void; setKpi(k: string | null): void;
  setRole(r: RoleType): void; setTab(t: Tab): void; setVizMode(v: '2d' | '3d'): void; toggleLayer(k: string): void; setTheme(t: 'light' | 'dark'): void;
  setMode(m: SimMode): void; saveScenario(s: Scenario): string[]; removeScenario(id: string): Promise<void>; activate(id: string | null): void;
  runDemo(id: string | null): void; decide(taskId: string, optionId: string, by: 'human' | 'copilot'): void; undoDecision(taskId: string): void; copilotAll(): void; duplicate(id: string): void; reset(): Promise<void>; exportData(): void; logDiag(kind: DiagEvent['kind'], message: string): void; logAudit(actor: string, action: string, entityRef?: string, scenarioRef?: string): void; gps: GpsState; baseView: OpsView; appliedPlan: OptPlan | null; applyPlan(p: OptPlan | null): void;
}
const C = createContext<Ctx>(null as never);
export const useOps = () => useContext(C);

let seq = 0;
const uid = (p: string) => `${p}-${clockNow().toString(36)}-${seq++}`;

export function OpsProvider({ children }: { children: ReactNode }) {
  const prefs = useMemo(() => repo.loadPrefs(), []);
  const [seed, setBaseline] = useState<Baseline | null>(null);
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [feed, setFeed] = useState<{ at: number; text: string }[]>([]);
  const [lastTickAt, setLastTickAt] = useState(() => clockNow());
  const baseline = useMemo(() => (seed ? deepFreeze(applyLive(seed, tick)) : null), [seed, tick]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setModeS] = useState<SimMode>('baseline');
  const [filters, setFilters] = useState<Filters>({ ...noFilters, ...(LENS[prefs.role as RoleType]?.filters ?? {}) });
  const [selection, setSel] = useState<Selection | null>(null);
  const [kpiKey, setKpiKey] = useState<string | null>(null);
  const [timePos, setTimePos] = useState<number | null>(null);
  const [wf, setWf] = useState<WfMap>({});
  const [appliedPlan, setAppliedPlan] = useState<OptPlan | null>(null);
  const [role, setRoleS] = useState<RoleType>(prefs.role as RoleType);
  const [tab, setTab] = useState<Tab>(LENS[prefs.role as RoleType]?.tab ?? 'overview');
  const [vizMode, setVizMode] = useState<'2d' | '3d'>(prefs.view === '3d' ? '3d' : '2d');
  const [layers, setLayers] = useState<Record<string, boolean>>({ gates: true, baggage: true, cargo: true, ...prefs.layers });
  const [theme, setTheme] = useState(prefs.theme);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [diag, setDiag] = useState<DiagEvent[]>([]);
  const [notice, setNotice] = useState('');

  const logDiag = useCallback((kind: DiagEvent['kind'], message: string) => {
    const e = { id: uid('dg'), time: clockNow(), kind, message };
    setDiag((d) => [...d.slice(-199), e]);
    void repo.appendDiag(e).catch(() => undefined);
  }, []);
  const logAudit = useCallback((actor: string, action: string, entityRef?: string, scenarioRef?: string) => {
    const e = { id: uid('au'), time: clockNow(), actor, action, entityRef, scenarioRef };
    setAudit((a) => [...a.slice(-199), e]);
    void repo.appendAudit(e).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t0 = performance.now();
    (async () => {
      try {
        const { baseline: b, migrated } = await repo.loadBaseline();
        setBaseline(deepFreeze(b));
        setScenarios(await repo.loadScenarios());
        setAudit(await repo.loadAudit());
        setDiag(await repo.loadDiag());
        setWf(Object.fromEntries((await repo.loadWorkflow()).map((e) => [e.id, { status: e.status as ExceptionState, ...('ownerId' in e ? { ownerId: e.ownerId } : {}), ...(e.ackAt !== undefined ? { ackAt: e.ackAt } : {}), ...(e.actAt !== undefined ? { actAt: e.actAt } : {}) }])));
        if (migrated) setNotice(tr('Stored data used an older schema/seed version and was reset to the current seed.'));
        logDiag('load', `Initialised in ${Math.round(performance.now() - t0)} ms`);
      } catch (e) {
        setBaseline(deepFreeze(await getProvider().load()));
        setNotice(tr('Browser storage unavailable; running in memory only.'));
        logDiag('load', `Storage failure: ${(e as Error).message}`);
      }
    })();
  }, [logDiag]);

  useEffect(() => {
    const h = (ev: ErrorEvent) => logDiag('render-error', ev.message);
    window.addEventListener('error', h);
    return () => window.removeEventListener('error', h);
  }, [logDiag]);

  useEffect(() => {
    if (!seed || paused) return;
    const id = setInterval(() => { setTick((n) => n + 1); setLastTickAt(clockNow()); }, 60000 / speed);
    return () => clearInterval(id);
  }, [seed, paused, speed]);
  const prevLive = useRef<Baseline | null>(null);
  useEffect(() => {
    if (!baseline) return;
    if (prevLive.current && prevLive.current !== baseline && tick > 0) {
      const ev = diffLive(prevLive.current, baseline);
      if (ev.length) setFeed((f) => [...ev.map((text) => ({ at: baseline.now, text })), ...f].slice(0, 60));
    }
    prevLive.current = baseline;
  }, [baseline, tick]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const t0 = performance.now();
    const id = requestAnimationFrame(() => logDiag('timing', `update to paint (role=${role}, view=${vizMode}, tab=${tab}, mode=${mode}, filters=${Object.values(filters).filter(Boolean).length}): ${Math.round(performance.now() - t0)} ms`));
    return () => cancelAnimationFrame(id);
  }, [role, vizMode, tab, mode, filters, selection, timePos, logDiag]);

  useEffect(() => { repo.savePrefs({ role, theme, view: vizMode, layers, panel: true }); document.documentElement.dataset.theme = theme; }, [role, theme, vizMode, layers]);

  const active = scenarios.find((s) => s.id === activeId) ?? null;
  const lang = getLang();
  const impact = useMemo(() => (baseline && active ? computeImpact(baseline, active, activeMitigations(active)) : undefined), [baseline, active, lang]);
  const mkView = useCallback((plan: OptPlan | null) => {
    if (!baseline) return null as never;
    const im = plan ? overlayPlan(impact, plan, baseline) : impact;
    const m: SimMode = plan && mode === 'baseline' ? 'scenario' : mode;
    const k = new OpsView(baseline, m, im, filters, null, timePos, wf).kpis().find((x) => x.key === kpiKey);
    return new OpsView(baseline, m, im, filters, k && k.ids.length ? k.ids : null, timePos, wf);
  }, [baseline, mode, impact, filters, kpiKey, timePos, wf]);
  const view = useMemo(() => mkView(appliedPlan), [mkView, appliedPlan]);
  const baseView = useMemo(() => mkView(null), [mkView]);
  const gps = useGpsTracker(seed, baseline);
  const related = useMemo(() => (view ? view.related(selection) : new Set<string>()), [view, selection]);

  const value: Ctx = {
    ready: !!baseline, live: { tick, speed, paused, lastTickAt, feed, setSpeed, setPaused, restart: () => { setTick(0); setFeed([]); setLastTickAt(clockNow()); } }, setTaskStatus: (id, st) => { if (!activeId) return; const upd = (l: Scenario[]) => l.map((x) => (x.id === activeId ? { ...x, taskStatus: { ...x.taskStatus, [id]: st } } : x)); const nx = upd(scenarios).find((x) => x.id === activeId)!; setScenarios(upd); void repo.saveScenario(nx); logAudit(role, `task ${id} → ${st}`, undefined, activeId); }, timePos, setTimePos, wf, notice, setNotice, baseline: baseline as Baseline, view, scenarios, activeId, mode, filters, selection, related, kpiKey,
    role, tab, vizMode, layers, theme, audit, diag, logDiag, logAudit, gps, baseView, appliedPlan, applyPlan: setAppliedPlan,
    setFilters, select: (s) => { setSel(s); if (s) logAudit(role, 'select', s.id, activeId ?? undefined); }, setKpi: setKpiKey,
    setRole: (r) => { setRoleS(r); setFilters({ ...noFilters, ...LENS[r].filters }); setTab(LENS[r].tab); setKpiKey(null); logAudit(r, 'switch-role'); },
    setTab, setVizMode, toggleLayer: (k) => setLayers((l) => ({ ...l, [k]: !l[k] })), setTheme,
    setMode: (m) => { setModeS(m); logAudit(role, `mode:${m}`, undefined, activeId ?? undefined); },
    saveScenario: (s) => {
      const errs = validateParams(s.params, baseline!);
      if (errs.length) { logDiag('invalid-scenario', errs.join(' | ')); return errs; }
      const saved = { ...s, state: s.id === activeId ? 'Active' : 'Valid' } as Scenario;
      setScenarios((l) => (l.some((x) => x.id === s.id) ? l.map((x) => (x.id === s.id ? saved : x)) : [...l, saved]));
      void repo.saveScenario(saved);
      logAudit(role, 'scenario-save', undefined, s.id);
      return [];
    },
    removeScenario: async (id) => {
      setScenarios((l) => l.filter((x) => x.id !== id));
      if (activeId === id) { setActiveId(null); setModeS('baseline'); }
      await repo.removeScenario(id);
      logAudit(role, 'scenario-delete', undefined, id);
    },
    activate: (id) => {
      setActiveId(id);
      setModeS(id ? 'scenario' : 'baseline');
      setScenarios((l) => l.map((s) => ({ ...s, state: s.id === id ? 'Active' : s.state === 'Active' ? 'Inactive' : s.state })));
      logAudit(role, id ? 'scenario-activate' : 'scenario-deactivate', undefined, id ?? undefined);
    },
    advance: (ids, to, owner) => {
      const next: WfMap = { ...wf };
      ids.forEach((id) => {
        const e = baseline!.exceptions.find((x) => x.id === id)!;
        const ownerId = typeof owner === 'function' ? owner(id) : owner;
        const prev = next[id];
        const ackAt = prev?.ackAt ?? (to !== 'New' ? baseline!.now : undefined);
        const actAt = prev?.actAt ?? (to === 'Assigned' || to === 'Monitoring' || to === 'Resolved' ? baseline!.now : undefined);
        const entry = { status: to, ...(ownerId === undefined ? ('ownerId' in (next[id] ?? {}) ? { ownerId: next[id].ownerId } : {}) : { ownerId: ownerId ?? undefined }), ...(ackAt !== undefined ? { ackAt } : {}), ...(actAt !== undefined ? { actAt } : {}) };
        next[id] = entry;
        void repo.saveWorkflow({ id, ...entry });
        logAudit(role, `workflow ${e.type}: ${wf[id]?.status ?? e.status} → ${to}`, id, activeId ?? undefined);
      });
      setWf(next);
    },
    decide: (taskId, optionId, by) => {
      if (!activeId) return;
      const upd = (l: Scenario[]) => l.map((s) => (s.id === activeId ? { ...s, decisions: { ...s.decisions, [taskId]: { optionId, by, at: clockNow(), opsAt: baseline!.now } } } : s));
      const next = upd(scenarios).find((s) => s.id === activeId)!;
      setScenarios(upd);
      void repo.saveScenario(next);
      logAudit(by === 'copilot' ? 'Copilot assist (accepted by ' + role + ')' : role, `decision ${taskId}=${optionId}`, undefined, activeId);
    },
    undoDecision: (taskId) => {
      if (!activeId) return;
      const upd = (l: Scenario[]) => l.map((s) => { if (s.id !== activeId) return s; const d = { ...s.decisions }; delete d[taskId]; return { ...s, decisions: d }; });
      const next = upd(scenarios).find((s) => s.id === activeId)!;
      setScenarios(upd);
      void repo.saveScenario(next);
      logAudit(role, `decision-undo ${taskId}`, undefined, activeId);
    },
    copilotAll: () => {
      const sc = scenarios.find((s) => s.id === activeId);
      const pack = sc && demoById(sc.id);
      if (!sc || !pack) return;
      let cur: Scenario = { ...sc, decisions: { ...sc.decisions } };
      pack.decisions.forEach((t) => {
        if (cur.decisions?.[t.id]) return;
        const a = advise(baseline!, cur, pack.decisions, t);
        cur = { ...cur, decisions: { ...cur.decisions, [t.id]: { optionId: a.optionId, by: 'copilot', at: clockNow(), opsAt: baseline!.now } } };
      });
      setScenarios((l) => l.map((s) => (s.id === cur.id ? cur : s)));
      void repo.saveScenario(cur);
      logAudit('Copilot assist (accepted by ' + role + ')', 'decisions-accepted-all', undefined, cur.id);
    },
    runDemo: (id) => {
      if (!id) { setActiveId(null); setModeS('baseline'); setScenarios((l) => l.map((s) => (s.state === 'Active' ? { ...s, state: 'Inactive' } : s))); logAudit(role, 'demo-baseline'); return; }
      const pack = DEMO_PACK.find((d) => d.id === id);
      if (!pack) return;
      const sc: Scenario = { ...structuredClone(pack.scenario), state: 'Active', createdAt: clockNow(), anchor: baseline!.now };
      setScenarios((l) => [...l.filter((x) => x.id !== sc.id).map((s) => (s.state === 'Active' ? { ...s, state: 'Inactive' as const } : s)), sc]);
      void repo.saveScenario(sc);
      setActiveId(sc.id); setModeS('scenario'); setSel(null); setKpiKey(null);
      logAudit(role, 'demo-run', undefined, sc.id);
    },
    duplicate: (id) => {
      const s = scenarios.find((x) => x.id === id);
      if (!s) return;
      const copy: Scenario = { ...structuredClone(s), id: uid('sc'), name: `${s.name} (copy)`, state: 'Inactive', createdAt: clockNow() };
      setScenarios((l) => [...l, copy]);
      void repo.saveScenario(copy);
    },
    reset: async () => {
      const b = await repo.resetPrototype();
      setBaseline(deepFreeze(b)); setAppliedPlan(null); setScenarios([]); setActiveId(null); setModeS('baseline'); setAudit([]); setDiag([]); setSel(null); setFilters(noFilters); setKpiKey(null); setTimePos(null); setWf({}); setTick(0); setFeed([]);
      setNotice(tr('Prototype reset to the seed baseline.'));
    },
    exportData: () => {
      const payload = {
        exportedAt: nowDate().toISOString(), schemaVersion: baseline!.schemaVersion, seedVersion: baseline!.seedVersion,
        baselineIdentifiers: Object.fromEntries(Object.entries(baseline!).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as { id: string }[]).map((x) => x.id)])),
        scenarioOverrides: scenarios, audit, diagnostics: diag,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'aoct-diagnostics.json'; a.click();
      URL.revokeObjectURL(url);
    },
  };

  if (!baseline) return <div className="loading">{tr('Loading prototype data…')}</div>;
  return <C.Provider value={value}>{children}</C.Provider>;
}
