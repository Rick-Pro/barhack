/**
 * Every Elasticsearch index name and field name lives in THIS file and nowhere else.
 *
 * The values below are UNVERIFIED PLACEHOLDERS, taken from reading the host starter notebooks
 * (they were not run). Check each line marked CHECK against `GET <index>/_mapping` in Kibana
 * Dev Tools, then edit this file only. Search for "CHECK" to find every line.
 */

export const INDEX = {
  cases: 'sf_311_cases', // CHECK: 311 index name
  businesses: 'sf_business_locations', // CHECK: business registry index name
} as const;

export const CASE = {
  location: 'location', // CHECK: must be a geo_point
  requestedAt: 'requested_at', // CHECK: date the 311 case was opened
  serviceName: 'service_name', // CHECK: must be a keyword for the terms aggregation (if it is text, use 'service_name.keyword')
  // CHECK: service names to leave out, wildcard and case-insensitive. Parking enforcement drowns everything else.
  // Set to [] to keep every case.
  excludeServiceNames: ['*parking*'] as readonly string[],
} as const;

export const BIZ = {
  name: 'name', // CHECK: business name, should be a text field (if it is a keyword, the match must be exact)
  address: 'address', // CHECK: street address, shown to the owner to confirm the match
  location: 'location', // CHECK: must be a geo_point
  openedAt: 'location_start', // CHECK: date this location opened (the other candidate is 'business_start')
  naics: 'naics_code', // CHECK: must be a keyword for prefix queries
  // CHECK: NAICS prefixes for bars (7224) and restaurants (7225). Set to [] to turn the filter off,
  // for example if naics_code is mapped as a number.
  naicsPrefixes: ['7224', '7225'] as readonly string[],
} as const;
