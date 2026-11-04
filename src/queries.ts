import { BIZ, CASE } from './fields';

export interface GeoPoint {
  lat: number;
  lon: number;
}

/** Query 1: trouble on the block. */
export const TROUBLE = { radius: '300m', radiusM: 300, days: 30, topN: 5 } as const;
/** Query 2: new competition nearby. */
export const NEWCOMERS = { radius: '800m', radiusM: 800, days: 365, size: 10 } as const;

type Json = Record<string, unknown>;

const geoFilter = (field: string, distance: string, p: GeoPoint) => ({
  geo_distance: { distance, [field]: { lat: p.lat, lon: p.lon } },
});

const naicsPrefixes = () =>
  BIZ.naicsPrefixes.map((value) => ({ prefix: { [BIZ.naics]: { value } } }));

// ---------------------------------------------------------------------------
// Query builders (pure: no clock, no network). Date math is done by Elasticsearch.
// ---------------------------------------------------------------------------

/** Find the bar by business name and get its location. */
export function buildBarLookup(name: string): Json {
  const prefer = naicsPrefixes(); // bars and restaurants rank higher when the filter is on
  return {
    size: 1,
    _source: [BIZ.name, BIZ.address, BIZ.location],
    query: {
      bool: {
        must: [
          {
            match: {
              [BIZ.name]: { query: name, operator: 'or', minimum_should_match: '75%', fuzziness: 'AUTO' },
            },
          },
        ],
        ...(prefer.length ? { should: prefer } : {}),
      },
    },
  };
}

/** 311 cases within 300 m in the last 30 days, top 5 service names. */
export function buildTroubleQuery(p: GeoPoint): Json {
  const excluded = CASE.excludeServiceNames.map((value) => ({
    wildcard: { [CASE.serviceName]: { value, case_insensitive: true } },
  }));
  return {
    size: 0,
    track_total_hits: true,
    query: {
      bool: {
        filter: [
          geoFilter(CASE.location, TROUBLE.radius, p),
          { range: { [CASE.requestedAt]: { gte: `now-${TROUBLE.days}d/d` } } },
        ],
        ...(excluded.length ? { must_not: excluded } : {}),
      },
    },
    aggs: { top_issues: { terms: { field: CASE.serviceName, size: TROUBLE.topN } } },
  };
}

/**
 * Places that opened within 800 m in the last 365 days, nearest first.
 * The range stops at today because some registry start dates are in the future.
 * Pass the matched bar's document id to leave the bar itself out.
 */
export function buildNewcomersQuery(p: GeoPoint, excludeId?: string): Json {
  const naics = naicsPrefixes();
  return {
    size: NEWCOMERS.size,
    track_total_hits: true,
    _source: [BIZ.name, BIZ.address, BIZ.openedAt],
    query: {
      bool: {
        filter: [
          geoFilter(BIZ.location, NEWCOMERS.radius, p),
          { range: { [BIZ.openedAt]: { gte: `now-${NEWCOMERS.days}d/d`, lte: 'now/d' } } },
          ...(naics.length ? [{ bool: { should: naics, minimum_should_match: 1 } }] : []),
        ],
        ...(excludeId ? { must_not: [{ ids: { values: [excludeId] } }] } : {}),
      },
    },
    sort: [{ _geo_distance: { [BIZ.location]: { lat: p.lat, lon: p.lon }, order: 'asc', unit: 'm' } }],
  };
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function toNum(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Accepts the geo_point shapes Elasticsearch returns: {lat,lon}, "lat,lon" or [lon,lat]. */
export function parseGeoPoint(v: unknown): GeoPoint | null {
  let lat: unknown;
  let lon: unknown;
  if (Array.isArray(v) && v.length >= 2) {
    lon = v[0];
    lat = v[1];
  } else if (typeof v === 'string') {
    const parts = v.split(',');
    if (parts.length === 2) {
      lat = parts[0];
      lon = parts[1];
    }
  } else if (isObj(v)) {
    lat = v.lat;
    lon = v.lon;
  }
  const la = toNum(lat);
  const lo = toNum(lon);
  if (la === null || lo === null || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return { lat: la, lon: lo };
}

interface EsHit {
  _id?: string;
  _source?: Json;
  sort?: unknown[];
}
interface EsResponse {
  hits?: { total?: { value?: number } | number; hits?: EsHit[] };
  aggregations?: Json;
}

const asResponse = (res: unknown): EsResponse => (isObj(res) ? (res as EsResponse) : {});
const text = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function totalHits(res: EsResponse): number {
  const t = res.hits?.total;
  if (typeof t === 'number') return t;
  return t?.value ?? 0;
}

export interface Bar {
  id: string;
  name: string;
  address: string;
  location: GeoPoint;
}

export function parseBarHit(res: unknown): Bar | null {
  const hit = asResponse(res).hits?.hits?.[0];
  if (!hit || !isObj(hit._source)) return null;
  const location = parseGeoPoint(hit._source[BIZ.location]);
  const name = text(hit._source[BIZ.name]);
  if (!location || !name || !hit._id) return null;
  return { id: hit._id, name, address: text(hit._source[BIZ.address]), location };
}

export interface TroubleSummary {
  radiusM: number;
  days: number;
  total: number;
  top: { service: string; count: number }[];
}

export function parseTrouble(res: unknown): TroubleSummary {
  const r = asResponse(res);
  const agg = r.aggregations?.top_issues;
  const buckets = isObj(agg) && Array.isArray(agg.buckets) ? agg.buckets : [];
  const top = buckets
    .filter(isObj)
    .map((b) => ({ service: text(b.key), count: toNum(b.doc_count) ?? 0 }))
    .filter((b) => b.service !== '');
  return { radiusM: TROUBLE.radiusM, days: TROUBLE.days, total: totalHits(r), top };
}

export interface Newcomer {
  name: string;
  address: string;
  opened: string;
  distanceM: number | null;
}

export interface NewcomersSummary {
  radiusM: number;
  days: number;
  total: number;
  items: Newcomer[];
}

export function parseNewcomers(res: unknown): NewcomersSummary {
  const r = asResponse(res);
  const items = (r.hits?.hits ?? []).filter((h) => isObj(h._source)).map((h) => {
    const src = h._source as Json;
    const d = toNum(h.sort?.[0]);
    return {
      name: text(src[BIZ.name]),
      address: text(src[BIZ.address]),
      opened: text(src[BIZ.openedAt]).slice(0, 10),
      distanceM: d === null ? null : Math.round(d),
    };
  });
  return { radiusM: NEWCOMERS.radiusM, days: NEWCOMERS.days, total: totalHits(r), items };
}

/** Everything Mistral is allowed to see. */
export interface BlockData {
  asOf: string;
  bar: { name: string; address: string };
  trouble: TroubleSummary;
  newcomers: NewcomersSummary;
}
