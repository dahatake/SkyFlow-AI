import { freezeClock } from '../src/domain/clock';

// Fixed instant (08:00 Changi) so seed-derived values and ids are reproducible.
freezeClock('2027-01-11T08:00:00+08:00');

