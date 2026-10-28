# Changi Airport asset data & attribution

| Asset | Source | License |
|---|---|---|
| `src/data/changi/routes.json` (airline → destination, 83 airlines) | [Wikipedia: Changi Airport – Airlines and destinations](https://en.wikipedia.org/wiki/Changi_Airport#Airlines_and_destinations), via `scripts/fetch-changi-routes.py` | CC BY-SA 4.0 |
| `public/assets/aircraft/a380-sq-9v-ska.jpg` | [Wikimedia Commons: Singapore Airlines A380-841 (9V-SKA) at Singapore Changi Airport](https://commons.wikimedia.org/wiki/File:Singapore_Airlines_A380-841_(9V-SKA)_at_Singapore_Changi_Airport.jpg) | Public domain |
| `public/assets/aircraft/b777-300.svg` | [Wikimedia Commons: Boeing 777-300 silhouette](https://commons.wikimedia.org/wiki/File:Boeing_777-300_silhouette.svg) (Peter Lowden) | CC BY-SA 4.0 |
| `public/assets/aircraft/b737-300er.svg` | [Wikimedia Commons: Boeing 737-300ER silhouette](https://commons.wikimedia.org/wiki/File:Boeing_737-300ER_silhouette.svg) | CC BY-SA 4.0 |

## Not available

- **Real flight schedule (Oct–Nov 2026):** changiairport.com serves flight data from a GraphQL API behind a WAF that rejects non-browser clients (HTTP 403). It was not bypassed. Provide an exported schedule (or licensed API access) and load it into `Baseline.flights`.
- **CAD / 3-view drawings:** no freely licensed CAD or plan-view drawings were found on Commons; manufacturers' CAD is proprietary. The app draws its own simplified top-view and uses the silhouettes above only as hover-card images.
