import { describe, expect, it } from 'vitest';
import { BIZ, CASE } from '../src/fields';
import {
  buildBarLookup,
  buildNewcomersQuery,
  buildTroubleQuery,
  parseBarHit,
  parseGeoPoint,
  parseNewcomers,
  parseTrouble,
} from '../src/queries';

const P = { lat: 37.7879, lon: -122.4075 };
// Round-trip through JSON so the tests read the body exactly as Elasticsearch would receive it.
const j = (v: unknown) => JSON.parse(JSON.stringify(v));

describe('buildBarLookup', () => {
  it('matches the business name and asks for name, address and location', () => {
    const q = j(buildBarLookup('Some Bar'));
    expect(q.size).toBe(1);
    expect(q.query.bool.must[0].match[BIZ.name].query).toBe('Some Bar');
    expect(q._source).toEqual([BIZ.name, BIZ.address, BIZ.location]);
  });
});

describe('buildTroubleQuery (311 within 300 m, last 30 days, top 5)', () => {
  const q = j(buildTroubleQuery(P));

  it('returns no hits, only counts and an aggregation', () => {
    expect(q.size).toBe(0);
    expect(q.track_total_hits).toBe(true);
  });

  it('filters by a 300 m geo_distance around the bar', () => {
    const geo = q.query.bool.filter[0].geo_distance;
    expect(geo.distance).toBe('300m');
    expect(geo[CASE.location]).toEqual(P);
  });

  it('filters to the last 30 days', () => {
    expect(q.query.bool.filter[1].range[CASE.requestedAt].gte).toBe('now-30d/d');
  });

  it('aggregates the top 5 service names', () => {
    expect(q.aggs.top_issues.terms).toEqual({ field: CASE.serviceName, size: 5 });
  });

  it('leaves out the configured noisy service names', () => {
    const wildcards = q.must_not ?? q.query.bool.must_not;
    expect(wildcards.map((w: any) => w.wildcard[CASE.serviceName].value)).toEqual(CASE.excludeServiceNames);
  });
});

describe('buildNewcomersQuery (opened within 800 m, last 365 days, nearest first)', () => {
  const q = j(buildNewcomersQuery(P, 'abc123'));

  it('asks for 10 hits and a true total', () => {
    expect(q.size).toBe(10);
    expect(q.track_total_hits).toBe(true);
  });

  it('filters by an 800 m geo_distance around the bar', () => {
    const geo = q.query.bool.filter[0].geo_distance;
    expect(geo.distance).toBe('800m');
    expect(geo[BIZ.location]).toEqual(P);
  });

  it('limits to the last 365 days and stops at today (some start dates are in the future)', () => {
    expect(q.query.bool.filter[1].range[BIZ.openedAt]).toEqual({ gte: 'now-365d/d', lte: 'now/d' });
  });

  it('keeps bars and restaurants only when NAICS prefixes are set', () => {
    const naics = q.query.bool.filter[2].bool;
    expect(naics.minimum_should_match).toBe(1);
    expect(naics.should.map((s: any) => s.prefix[BIZ.naics].value)).toEqual(BIZ.naicsPrefixes);
  });

  it('sorts by distance, nearest first, in meters', () => {
    expect(q.sort[0]._geo_distance).toMatchObject({ [BIZ.location]: P, order: 'asc', unit: 'm' });
  });

  it('leaves the matched bar out of its own competition list', () => {
    expect(q.query.bool.must_not).toEqual([{ ids: { values: ['abc123'] } }]);
    expect(j(buildNewcomersQuery(P)).query.bool.must_not).toBeUndefined();
  });
});

describe('parseGeoPoint', () => {
  it('reads an object, a "lat,lon" string and a [lon, lat] array', () => {
    expect(parseGeoPoint({ lat: 37.78, lon: -122.41 })).toEqual({ lat: 37.78, lon: -122.41 });
    expect(parseGeoPoint({ lat: '37.78', lon: '-122.41' })).toEqual({ lat: 37.78, lon: -122.41 });
    expect(parseGeoPoint('37.78,-122.41')).toEqual({ lat: 37.78, lon: -122.41 });
    expect(parseGeoPoint([-122.41, 37.78])).toEqual({ lat: 37.78, lon: -122.41 });
  });

  it('rejects junk and out-of-range values', () => {
    expect(parseGeoPoint(null)).toBeNull();
    expect(parseGeoPoint('nope')).toBeNull();
    expect(parseGeoPoint({ lat: 120, lon: 0 })).toBeNull();
    expect(parseGeoPoint({ lat: '', lon: '' })).toBeNull();
  });
});

describe('response parsing', () => {
  it('reads the bar hit', () => {
    const res = {
      hits: {
        hits: [{ _id: 'abc123', _source: { [BIZ.name]: 'Some Bar', [BIZ.address]: '1 Main St', [BIZ.location]: { lat: 37.78, lon: -122.41 } } }],
      },
    };
    expect(parseBarHit(res)).toEqual({ id: 'abc123', name: 'Some Bar', address: '1 Main St', location: { lat: 37.78, lon: -122.41 } });
    expect(parseBarHit({ hits: { hits: [] } })).toBeNull();
    expect(parseBarHit({})).toBeNull();
  });

  it('reads the 311 total and top buckets', () => {
    const res = {
      hits: { total: { value: 42 } },
      aggregations: { top_issues: { buckets: [{ key: 'Graffiti', doc_count: 20 }, { key: 'Street Cleaning', doc_count: 9 }] } },
    };
    expect(parseTrouble(res)).toEqual({
      radiusM: 300,
      days: 30,
      total: 42,
      top: [{ service: 'Graffiti', count: 20 }, { service: 'Street Cleaning', count: 9 }],
    });
    expect(parseTrouble({}).total).toBe(0);
  });

  it('reads new places with rounded distances', () => {
    const res = {
      hits: {
        total: { value: 7 },
        hits: [{ _source: { [BIZ.name]: 'New Spot', [BIZ.address]: '2 Oak St', [BIZ.openedAt]: '2026-09-01T00:00:00.000' }, sort: [123.6] }],
      },
    };
    expect(parseNewcomers(res)).toEqual({
      radiusM: 800,
      days: 365,
      total: 7,
      items: [{ name: 'New Spot', address: '2 Oak St', opened: '2026-09-01', distanceM: 124 }],
    });
  });
});
