import { useState } from 'react';
import { Bot24Regular, Checkmark24Filled, Dismiss24Regular, ShieldCheckmark24Regular } from '@fluentui/react-icons';
import { DEMO_PACK, demoById } from '../domain/demo';
import { useOps } from '../storage/store';
import { localProposal, type Proposal } from '../agent/client';
import { makeId } from '../domain/clock';
import { tr } from '../i18n';
import { trData } from '../i18n/data';

/** Agents propose, the engine validates, a person approves. Nothing is applied without the approval click. */
export function AgentView() {
  const { baseline, scenarios, activeId, runDemo, decideMany, role, logAudit } = useOps();
  const [demoId, setDemoId] = useState(activeId && demoById(activeId) ? activeId : DEMO_PACK[0].id);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const pack = demoById(demoId)!;
  const sc = scenarios.find((s) => s.id === demoId) ?? null;
  const canApprove = ['SIOC Duty Manager', 'Control Tower Lead', 'BU Ops Manager'].includes(role);

  const run = () => {
    if (!sc) { setErr(tr('Start the scenario first.')); return; }
    setErr('');
    try { setProposal(localProposal(baseline, sc, demoId, makeId('pr'))); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const decideAll = async (verdict: 'approve' | 'reject') => {
    if (!proposal) return;
    if (!canApprove || proposal.status !== 'Proposed') { setErr(tr('An authorized manager must approve proposals.')); return; }
    if (!sc || activeId !== proposal.demoId) { setErr(tr('Start the proposed scenario before approving.')); return; }
    setSaving(true); setErr('');
    try {
      if (verdict === 'approve') await decideMany(proposal.items, 'copilot');
      logAudit(role, `agent proposal ${proposal.id} ${verdict}d`, undefined, demoId);
      setProposal({ ...proposal, status: verdict === 'approve' ? 'Applied' : 'Rejected' });
    } catch (e) {
      setErr(tr('Approval failed: {message}', { message: e instanceof Error ? e.message : String(e) }));
    } finally { setSaving(false); }
  };

  return (
    <section className="card" aria-label={tr('Task Resolver with AI Agent')}>
      <h2><Bot24Regular /> {tr('Task Resolver with AI Agent')} <small className="muted">· {tr('Detect → Triage → Resolve → Notify, with a person approving')}</small></h2>
      <p className="muted"><ShieldCheckmark24Regular /> {tr('The agent only selects among options the scenario engine computed. Numbers always come from the engine. Nothing changes until you approve.')}</p>
      <div className="row">
        <label>{tr('Scenario')} <select disabled={saving} value={demoId} onChange={(e) => { setDemoId(e.target.value); setProposal(null); }}>{DEMO_PACK.map((d) => <option key={d.id} value={d.id}>{trData(d.title)}</option>)}</select></label>
        <span className="badge ai">{tr('Rule-based advisor')}</span>
        {(!sc || activeId !== demoId) && <button onClick={() => { runDemo(demoId); setProposal(null); }}>{tr('Start scenario')}</button>}
        <button className="primary" disabled={saving || !sc || activeId !== demoId} onClick={run}><Bot24Regular /> {tr('Run agent pipeline')}</button>
      </div>
      <p className="notice">{tr('Local demo: deterministic rules only. No LLM, cloud services or external notifications.')}</p>
      {err && <p role="alert" className="warn">{err}</p>}
      {proposal && (
        <div>
          <h3>{tr('Proposal')} <span className={`badge ${proposal.status === 'Applied' ? 'ok' : 'open'}`}>{tr(proposal.status)}</span>
            <span className="badge ai"> {tr('Rule-based advisor')}</span></h3>
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
            <button className="primary" disabled={saving || !canApprove || activeId !== proposal.demoId || proposal.status !== 'Proposed'} onClick={() => decideAll('approve')}><Checkmark24Filled /> {tr('Approve and apply')}</button>
            <button disabled={saving || !canApprove || activeId !== proposal.demoId || proposal.status !== 'Proposed'} onClick={() => decideAll('reject')}><Dismiss24Regular /> {tr('Reject')}</button>
            {!canApprove && <span className="muted">{tr('An authorized manager must approve proposals.')}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
