/**
 * Every Elasticsearch index name and field name lives in THIS file and nowhere else.
 *
 * Verified against the explicit mappings in the host notebooks (sf_311_cases.ipynb and
 * sf_business_locations.ipynb in jdarmada/elastic-mistral-hacknight). Still worth a quick
 * `GET <index>/_mapping` in Kibana Dev Tools after the data is loaded.
 */

export const INDEX = {
  cases: 'sf_311_cases', // notebook INDEX
  businesses: 'sf_business_locations', // notebook INDEX
} as const;

export const CASE = {
  location: 'location', // geo_point
  requestedAt: 'requested_at', // date, the day the 311 case was opened
  serviceName: 'service_name', // keyword, so the terms aggregation works directly
  // Service names to leave out, wildcard and case-insensitive. Parking enforcement drowns everything else.
  // Set to [] to keep every case.
  excludeServiceNames: ['*parking*'] as readonly string[],
} as const;

export const BIZ = {
  name: 'name', // text (with a .keyword subfield)
  address: 'address', // text (with a .keyword subfield), shown to the owner to confirm the match
  location: 'location', // geo_point
  openedAt: 'location_start', // date this location opened (business_start is when the DBA began)
  naics: 'naics_code', // keyword, so prefix queries work (Paname SF and Paris 75 are both 722511)
  // NAICS prefixes for bars (7224) and restaurants (7225). Set to [] to turn the filter off.
  naicsPrefixes: ['7224', '7225'] as readonly string[],
} as const;
