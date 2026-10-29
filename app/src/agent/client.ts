import { advise, type Score } from '../domain/judgement';
import { demoById } from '../domain/demo';
import type { Baseline, Scenario } from '../domain/types';

export type ProposalStatus = 'Proposed' | 'Approved' | 'Rejected' | 'Applied';
export interface ProposalItem { taskId: string; optionId: string; rationale: string; confidence: number | 'High' | 'Medium' | 'Low'; kpiDelta?: Partial<Record<keyof Score, number>> }
export interface TraceStep { agent: string; tool?: string | null; ms: number; note: string }
export interface Proposal {
  id: string; demoId: string; status: ProposalStatus; mode: 'agent' | 'rules'; fallbackUsed: boolean;
  items: ProposalItem[]; steps: TraceStep[]; traceId: string; source: 'service' | 'local';
}

const RAW = (import.meta as { env?: Record<string, string> }).env?.VITE_AGENT_API_URL ?? '';
// 'same-origin' means the Static Web App proxies /api/* to the agent API (linked backend), so no absolute URL is used.
const BASE = RAW === 'same-origin' ? '' : RAW;
export const agentConfigured = () => RAW.length > 0;

/** Deterministic in-browser proposal from the same engine advice the service uses as its fallback. */
export function localProposal(b: Baseline, sc: Scenario, demoId: string, id: string): Proposal {
  const pack = demoById(demoId);
  if (!pack) throw new Error(`Unknown demo ${demoId}`);
  const items = pack.decisions.map((t): ProposalItem => {
    const a = advise(b, sc, pack.decisions, t);
    const none = a.scores['none'];
    const picked = a.scores[a.optionId];
    return {
      taskId: t.id, optionId: a.optionId, rationale: a.rationale, confidence: 1,
      kpiDelta: none && picked ? { weighted: picked.weighted - none.weighted, breach: picked.breach - none.breach, blocked: picked.blocked - none.blocked } : undefined,
    };
  });
  const steps: TraceStep[] = [
    { agent: 'Detect', tool: 'get_exceptions', ms: 0, note: 'Read exceptions from the live baseline' },
    { agent: 'Triage', tool: 'rank_by_sla', ms: 0, note: 'Ranked by SLA exposure' },
    { agent: 'Resolver', tool: 'compare_options', ms: 0, note: `Compared options for ${pack.decisions.length} decision tasks with the scenario engine` },
    { agent: 'Comms', ms: 0, note: 'Prepared owner notification (not sent in local mode)' },
  ];
  return { id, demoId, status: 'Proposed', mode: 'rules', fallbackUsed: true, items, steps, traceId: `local-${id}`, source: 'local' };
}

async function call<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(`${BASE}${path}`, { ...init, signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return (await r.json()) as T;
  } finally { clearTimeout(t); }
}

interface ServiceStep { agent: string; tool?: string | null; durationMs?: number; detail?: string | null; status?: string }
interface ServiceProposal extends Omit<Proposal, 'source' | 'steps'> { steps: ServiceStep[] }

export async function propose(b: Baseline, sc: Scenario, demoId: string, mode: 'agent' | 'rules', id: string): Promise<Proposal> {
  if (mode === 'agent' && agentConfigured()) {
    try {
      const p = await call<ServiceProposal>('/api/agent/propose', { method: 'POST', body: JSON.stringify({ demoId, mode }) });
      return { ...p, source: 'service', steps: p.steps.map((s) => ({ agent: s.agent, tool: s.tool, ms: Math.round(s.durationMs ?? 0), note: s.detail ?? s.status ?? '' })) };
    } catch { /* deterministic local fallback below */ }
  }
  return localProposal(b, sc, demoId, id);
}

export async function review(p: Proposal, verdict: 'approve' | 'reject', actor: string, role: string): Promise<void> {
  if (p.source !== 'service') return;
  const body = JSON.stringify({ actor, role });
  await call(`/api/agent/proposals/${encodeURIComponent(p.id)}/${verdict}`, { method: 'POST', body });
  if (verdict === 'approve') await call(`/api/agent/proposals/${encodeURIComponent(p.id)}/apply`, { method: 'POST', body });
}
