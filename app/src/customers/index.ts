import sats from './sats-changi/customer.json';
import generic from './generic-hub/customer.json';
import { validateCustomer, type Customer } from './schema';

export type { Customer } from './schema';
export const CUSTOMERS: Record<string, Customer> = { [sats.id]: sats as Customer, [generic.id]: generic as Customer };

const fromUrl = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('customer') : null);
const fromEnv = () => (import.meta as { env?: Record<string, string> }).env?.VITE_CUSTOMER;

const fromStorage = (key: string) => { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; } };
function importedCustomers(): Record<string, Customer> {
  try { return JSON.parse(fromStorage('aoct-imported-customers') ?? '{}') as Record<string, Customer>; } catch { return {}; }
}

/** IANA time zone of the active airport. */
export const customerTimeZone = (): string => activeCustomer().airport.timezone;
/** Airport name in the given language, falling back to the English name. */
export const airportName = (lang: string): string => { const a = activeCustomer().airport; return (a.labels as Record<string, string> | undefined)?.[lang] ?? a.name; };
/** Short zone label such as GMT+9 for the active airport. */
export function zoneLabel(): string {
  const p = new Intl.DateTimeFormat('en', { timeZone: customerTimeZone(), timeZoneName: 'short' }).formatToParts(new Date());
  return p.find((x) => x.type === 'timeZoneName')?.value ?? customerTimeZone();
}

/** Active customer: ?customer=<id> > VITE_CUSTOMER > imported airport chosen in the importer > sats-changi. Invalid files fail loudly at load. */
export function activeCustomer(): Customer {
  const id = fromUrl() ?? fromEnv() ?? fromStorage('aoct-active-customer') ?? 'sats-changi';
  const c = CUSTOMERS[id] ?? importedCustomers()[id] ?? CUSTOMERS['sats-changi'];
  const errs = validateCustomer(c);
  if (errs.length) throw new Error(`Invalid customer ${c.id}: ${errs.join('; ')}`);
  return c;
}
