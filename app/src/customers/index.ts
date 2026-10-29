import sats from './sats-changi/customer.json';
import generic from './generic-hub/customer.json';
import { validateCustomer, type Customer } from './schema';

export type { Customer } from './schema';
export const CUSTOMERS: Record<string, Customer> = { [sats.id]: sats as Customer, [generic.id]: generic as Customer };

const fromUrl = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('customer') : null);
const fromEnv = () => (import.meta as { env?: Record<string, string> }).env?.VITE_CUSTOMER;

/** Active customer: ?customer=<id> > VITE_CUSTOMER > sats-changi. Invalid files fail loudly at load. */
export function activeCustomer(): Customer {
  const id = fromUrl() ?? fromEnv() ?? 'sats-changi';
  const c = CUSTOMERS[id] ?? CUSTOMERS['sats-changi'];
  const errs = validateCustomer(c);
  if (errs.length) throw new Error(`Invalid customer ${c.id}: ${errs.join('; ')}`);
  return c;
}
