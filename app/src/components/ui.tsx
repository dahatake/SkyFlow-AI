import { tr } from '../i18n';
import type { SlaLevel, Severity } from '../domain/types';

export const SLA_GLYPH: Record<string, string> = { Normal: '✓', Watch: '!', AtRisk: '▲', Breach: '✖' };
export const SEV_GLYPH: Record<string, string> = { Low: '○', Medium: '◐', High: '●', Critical: '✖' };
export const RISK_COLOR: Record<string, string> = { Normal: '#107c10', Watch: '#c19c00', AtRisk: '#d83b01', Breach: '#a4262c' };
export const SEV_COLOR: Record<string, string> = { Low: '#107c10', Medium: '#c19c00', High: '#d83b01', Critical: '#a4262c' };

/** Status is never color alone: each badge pairs a glyph and text (NFR-002). */
export function Badge({ level, kind = 'sla' }: { level: SlaLevel | Severity | string; kind?: 'sla' | 'sev' | 'plain' }) {
  const glyph = kind === 'sla' ? SLA_GLYPH[level] : kind === 'sev' ? SEV_GLYPH[level] : '•';
  const color = (kind === 'sev' ? SEV_COLOR : RISK_COLOR)[level] ?? '#605e5c';
  return (
    <span className="badge" style={{ borderColor: color, color }}>
      <span aria-hidden="true">{glyph}</span> {tr(level)}
    </span>
  );
}

export function Tag({ simulated }: { simulated: boolean }) {
  return <span className={simulated ? 'tag sim' : 'tag base'}>{simulated ? tr('Simulated') : tr('Baseline')}</span>;
}
