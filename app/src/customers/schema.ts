export interface CustomerAssumptions {
  costPerDelayMinute: number; slaBreachPenalty: number; blockedTaskCost: number;
  manualResponseMinutes: number; agentResponseMinutes: number; disruptionsPerMonth: number; source: string;
}
export interface Customer {
  id: string; name: string; programme: string; productName: string;
  airport: { iata: string; name: string; timezone: string; country?: string; lat?: number; lon?: number; labels?: Partial<Record<'en' | 'zh' | 'ko' | 'ja', string>> };
  currency: string; assumptions: CustomerAssumptions;
  deck: { mvpScopeDate: string; buildStartDate: string; anchorScenario: string };
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min;
const isDate = (v: unknown) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Returns a list of problems; an empty list means the customer file is valid. */
export function validateCustomer(c: unknown): string[] {
  const e: string[] = [];
  const o = c as Partial<Customer> | null;
  if (!o || typeof o !== 'object') return ['customer must be an object'];
  (['id', 'name', 'programme', 'productName', 'currency'] as const).forEach((k) => { if (!isStr(o[k])) e.push(`${k} is required`); });
  if (isStr(o.id) && !/^[a-z0-9-]+$/.test(o.id)) e.push('id must be lowercase letters, digits or dashes');
  if (!o.airport || !isStr(o.airport.iata) || !isStr(o.airport.name) || !isStr(o.airport.timezone)) e.push('airport.{iata,name,timezone} are required');
  else {
    try { new Intl.DateTimeFormat('en', { timeZone: o.airport.timezone }); } catch { e.push(`airport.timezone "${o.airport.timezone}" is not a valid IANA zone`); }
  }
  const a = o.assumptions;
  if (!a) e.push('assumptions are required');
  else {
    (['costPerDelayMinute', 'slaBreachPenalty', 'blockedTaskCost', 'manualResponseMinutes', 'agentResponseMinutes', 'disruptionsPerMonth'] as const)
      .forEach((k) => { if (!isNum(a[k])) e.push(`assumptions.${k} must be a non-negative number`); });
    if (!isStr(a.source)) e.push('assumptions.source must say where the numbers come from');
    if (isNum(a.manualResponseMinutes) && isNum(a.agentResponseMinutes) && a.agentResponseMinutes > a.manualResponseMinutes) e.push('agentResponseMinutes must not exceed manualResponseMinutes');
  }
  if (!o.deck || !isDate(o.deck.mvpScopeDate) || !isDate(o.deck.buildStartDate) || !isStr(o.deck.anchorScenario)) e.push('deck.{mvpScopeDate,buildStartDate,anchorScenario} are required (dates as yyyy-MM-dd)');
  return e;
}
