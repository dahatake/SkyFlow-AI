import { advise, type Score } from '../domain/judgement';
import { demoById } from '../domain/demo';
import type { Baseline, Scenario } from '../domain/types';

export type ProposalStatus = 'Proposed' | 'Approved' | 'Rejected' | 'Applied';
export interface ProposalItem { taskId: string; optionId: string; rationale: string; confidence: number | 'High' | 'Medium' | 'Low'; kpiDelta?: Partial<Record<keyof Score, number>> }
export interface TraceStep { agent: string; tool?: string | null; ms: number; note: string }
export interface Proposal {
  id: string; demoId: string; status: ProposalStatus; mode: 'rules'; fallbackUsed: false;
  items: ProposalItem[]; steps: TraceStep[]; traceId: string; source: 'local';
}

/** Deterministic in-browser proposal; no model, API or network dependency. */
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
  return { id, demoId, status: 'Proposed', mode: 'rules', fallbackUsed: false, items, steps, traceId: `local-${id}`, source: 'local' };
}
