// Single injectable time source so demos and tests are reproducible.
// `?clock=2027-01-11T08:00:00+08:00` in the URL freezes wall-clock time for demo mode.
type ClockFn = () => number;

let source: ClockFn = () => Date.now();

export const now = (): number => source();
export const nowDate = (): Date => new Date(source());

export function setClock(fn: ClockFn | null) { source = fn ?? (() => Date.now()); }

export function freezeClock(at: number | string | Date) {
  const t = typeof at === 'number' ? at : new Date(at).getTime();
  if (!Number.isFinite(t)) throw new Error(`Invalid clock value: ${String(at)}`);
  source = () => t;
}

export function installClockFromUrl(search: string = typeof location !== 'undefined' ? location.search : '') {
  const v = new URLSearchParams(search).get('clock');
  if (!v) return false;
  try { freezeClock(v); return true; } catch { return false; }
}

let counter = 0;
// Deterministic when the clock is frozen: id depends on the clock and a per-process counter only.
export const makeId = (prefix: string) => `${prefix}-${now().toString(36)}-${counter++}`;
export const resetIdCounter = () => { counter = 0; };

// Side effect on import so modules that read the clock at load time (seed.ts) already see the override.
installClockFromUrl();
