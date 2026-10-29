import type { Baseline, Severity } from './types';
import { SEVERITY_ORDER } from './types';

/** Tukey five-number summary with 1.5 x IQR fences (exploratory data analysis). */
export interface FiveNumber { n: number; min: number; q1: number; median: number; q3: number; max: number; lowFence: number; highFence: number; outliers: number[] }

export function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function fiveNumber(values: number[]): FiveNumber {
  const s = [...values].sort((a, b) => a - b);
  const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr, highFence = q3 + 1.5 * iqr;
  const inside = s.filter((v) => v >= lowFence && v <= highFence);
  return {
    n: s.length, min: s[0] ?? 0, q1, median: quantile(s, 0.5), q3, max: s[s.length - 1] ?? 0,
    lowFence: inside[0] ?? 0, highFence: inside[inside.length - 1] ?? 0,
    outliers: s.filter((v) => v < lowFence || v > highFence),
  };
}

export function mean(values: number[]): number { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1));
}

/** Pearson correlation; null when either series is constant or too short. */
export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length < 3 || xs.length !== ys.length) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

export interface DelayPoint { taskId: string; taskType: string; buId: string; priority: 1 | 2 | 3; plannedTime: number; delayMin: number }

/** Forecast slip per task in minutes: the core measure analysed across the other dimensions. */
export function delayPoints(b: Baseline): DelayPoint[] {
  return b.tasks.map((t) => ({ taskId: t.id, taskType: t.taskType, buId: t.buId, priority: t.priority, plannedTime: t.plannedTime, delayMin: t.forecastTime - t.plannedTime }));
}

export function histogramBins(values: number[], binSize: number): { x0: number; x1: number; count: number }[] {
  if (!values.length || binSize <= 0) return [];
  const lo = Math.floor(Math.min(...values) / binSize) * binSize;
  const hi = Math.max(Math.floor(Math.max(...values) / binSize) * binSize + binSize, lo + binSize);
  const bins: { x0: number; x1: number; count: number }[] = [];
  for (let x = lo; x < hi; x += binSize) bins.push({ x0: x, x1: x + binSize, count: 0 });
  values.forEach((v) => { bins[Math.min(bins.length - 1, Math.floor((v - lo) / binSize))].count++; });
  return bins;
}

export interface HeatCell { type: string; severity: Severity; count: number }

export function exceptionHeatmap(b: Baseline): HeatCell[] {
  const types = [...new Set(b.exceptions.map((e) => e.type))].sort();
  return types.flatMap((type) => SEVERITY_ORDER.map((severity) => ({
    type, severity, count: b.exceptions.filter((e) => e.type === type && e.severity === severity).length,
  })));
}

export interface UtilisationRow { buId: string; planned: number; available: number; engaged: number; utilisation: number | null; gap: number }

export function staffUtilisation(b: Baseline): UtilisationRow[] {
  return b.bus.map((bu) => {
    const rows = b.staff.filter((s) => s.buId === bu.id);
    const planned = rows.reduce((a, s) => a + s.planned, 0);
    const available = rows.reduce((a, s) => a + s.available, 0);
    const engaged = rows.reduce((a, s) => a + s.engaged, 0);
    return { buId: bu.id, planned, available, engaged, utilisation: available ? engaged / available : null, gap: planned - available };
  });
}

export interface QualityRow { entity: string; records: number; missing: number; completeness: number }

/** Data profiling: share of records that carry their optional-but-expected fields. */
export function dataQuality(b: Baseline): QualityRow[] {
  const row = (entity: string, records: number, missing: number): QualityRow => ({ entity, records, missing, completeness: records ? 1 - missing / records : 1 });
  return [
    row('Flights', b.flights.length, b.flights.filter((f) => f.ata === undefined && ['Arrived', 'Turnaround', 'Ready', 'Departed'].includes(f.status)).length),
    row('Turnarounds', b.turnarounds.length, b.turnarounds.filter((t) => t.actualStart === undefined && t.phase !== 'NotStarted').length),
    row('Tasks', b.tasks.length, b.tasks.filter((t) => t.actualTime === undefined && t.status === 'Complete').length),
    row('Exceptions', b.exceptions.length, b.exceptions.filter((e) => !e.ownerId).length),
    row('Assets', b.assets.length, b.assets.filter((a) => a.status === 'Unknown').length),
  ];
}
