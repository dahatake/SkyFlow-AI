import { useState } from 'react';
import { Bot24Regular, Checkmark24Filled, Dismiss24Regular, ShieldCheckmark24Regular } from '@fluentui/react-icons';
import { DEMO_PACK, demoById } from '../domain/demo';
import { useOps } from '../storage/store';
import { agentConfigured, propose, review, type Proposal } from '../agent/client';
import { makeId } from '../domain/clock';
import { tr } from '../i18n';
import { trData } from '../i18n/data';

/** Agents propose, the engine validates, a person approves. Nothing is applied without the approval click. */
export function AgentView() {
  const { baseline, scenarios, activeId, runDemo, decide, role, logAudit } = useOps();
  const [demoId, setDemoId] = useState(activeId && demoById(activeId) ? activeId : DEMO_PACK[0].id);
  const [mode, setMode] = useState<'agent' | 'rules'>(agentConfigured() ? 'agent' : 'rules');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [err, setErr] = useState('');
  const pack = demoById(demoId)!;
  const sc = scenarios.find((s) => s.id === demoId) ?? null;
  const canApprove = role !== 'Observer';

  const run = async () => {
    if (!sc) { setErr(tr('Start the scenario first.')); return; }
    setBusy(true); setErr('');
    try { setProposal(await propose(baseline, sc, demoId, mode, makeId('pr'))); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const decideAll = async (verdict: 'approve' | 'reject') => {
    if (!proposal) return;
    try { await review(proposal, verdict, role, role); } catch (e) { setErr(tr('Approval failed: {message}', { message: (e as Error).message })); return; }
    if (verdict === 'approve') proposal.items.forEach((i) => decide(i.taskId, i.optionId, 'copilot'));
    logAudit(role, `agent proposal ${proposal.id} ${verdict}d`, undefined, demoId);
    setProposal({ ...proposal, status: verdict === 'approve' ? 'Applied' : 'Rejected' });
  };

  return (
    <section className="card" aria-label={tr('AI agent')}>
      <h2><Bot24Regular /> {tr('AI agent')} <small className="muted">· {tr('Detect → Triage → Resolve → Notify, with a person approving')}</small></h2>
      <p className="muted"><ShieldCheckmark24Regular /> {tr('The agent only selects among options the scenario engine computed. Numbers always come from the engine. Nothing changes until you approve.')}</p>
      <div className="row">
        <label>{tr('Scenario')} <select value={demoId} onChange={(e) => { setDemoId(e.target.value); setProposal(null); }}>{DEMO_PACK.map((d) => <option key={d.id} value={d.id}>{trData(d.title)}</option>)}</select></label>
        <label>{tr('Mode')} <select value={mode} onChange={(e) => setMode(e.target.value as 'agent' | 'rules')}>
          <option value="agent">{tr('AI agent')}</option><option value="rules">{tr('Rule-based advisor')}</option></select></label>
        {!sc && <button onClick={() => runDemo(demoId)}>{tr('Start scenario')}</button>}
        <button className="primary" disabled={busy || !sc} onClick={run}><Bot24Regular /> {busy ? tr('Working…') : tr('Run agent pipeline')}</button>
      </div>
      {mode === 'agent' && !agentConfigured() && <p className="notice">{tr('Agent service is not configured (VITE_AGENT_API_URL). Using the deterministic rule-based advisor.')}</p>}
      {err && <p role="alert" className="warn">{err}</p>}
      {proposal && (
        <div>
          <h3>{tr('Proposal')} <span className={`badge ${proposal.status === 'Applied' ? 'ok' : 'open'}`}>{tr(proposal.status)}</span>
            {proposal.fallbackUsed && <span className="badge ai"> {tr('Rule-based fallback')}</span>}</h3>
          <ul className="plain">
            {proposal.items.map((i) => {
              const t = pack.decisions.find((x) => x.id === i.taskId);
              const o = t?.options.find((x) => x.id === i.optionId);
              return <li key={i.taskId}><strong>{t ? trData(t.title) : i.taskId}</strong>: {o ? trData(o.label) : i.optionId} · <span className="muted">{trData(i.rationale)}</span></li>;
            })}
          </ul>
          <h3>{tr('Agent trace')}</h3>
          <ol className="plain">{proposal.steps.map((s, n) => <li key={n}><strong>{s.agent}</strong>{s.tool ? <code> {s.tool}</code> : null} · {s.ms} ms · {s.note}</li>)}</ol>
          <p className="muted">{tr('Trace {id} · source {src}', { id: proposal.traceId, src: proposal.source })}</p>
          <div className="row">
            <button className="primary" disabled={!canApprove || proposal.status !== 'Proposed'} onClick={() => decideAll('approve')}><Checkmark24Filled /> {tr('Approve and apply')}</button>
            <button disabled={!canApprove || proposal.status !== 'Proposed'} onClick={() => decideAll('reject')}><Dismiss24Regular /> {tr('Reject')}</button>
            {!canApprove && <span className="muted">{tr('Observer lens is read-only.')}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
