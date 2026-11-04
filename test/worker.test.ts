import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env';
import { BIZ, INDEX } from '../src/fields';
import worker from '../src/index';
import { MISTRAL_MODEL, buildMessages, extractJson, validateBrief } from '../src/mistral';

// Fake values so the tests can prove they never leak. These are not real secrets.
const env: Env = {
  ELASTIC_URL: 'https://es.example.test/',
  ELASTIC_API_KEY: 'fake-elastic-key-for-tests',
  MISTRAL_API_KEY: 'fake-mistral-key-for-tests',
};

const brief = {
  en: { bullets: ['one', 'two', 'three'], action: 'Do this' },
  es: { bullets: ['uno', 'dos', 'tres'], action: 'Haz esto' },
};
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const completion = (content: string) => ok({ choices: [{ message: { content } }] });

const lookupHit = {
  hits: { hits: [{ _id: 'bar1', _source: { [BIZ.name]: 'Test Bar', [BIZ.address]: '1 Main St', [BIZ.location]: { lat: 37.78, lon: -122.41 } } }] },
};
const troubleRes = { hits: { total: { value: 3 } }, aggregations: { top_issues: { buckets: [{ key: 'Graffiti', doc_count: 3 }] } } };
const newcomersRes = { hits: { total: { value: 1 }, hits: [{ _source: { [BIZ.name]: 'New Spot', [BIZ.address]: '2 Oak St', [BIZ.openedAt]: '2026-09-01' }, sort: [200] }] } };

type Call = { url: string; init?: RequestInit };

function stubFetch(opts: { lookup?: unknown; mistral?: () => Response } = {}): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.startsWith('https://api.mistral.ai/')) return opts.mistral ? opts.mistral() : completion(JSON.stringify(brief));
      if (url.includes(`/${INDEX.cases}/`)) return ok(troubleRes);
      return JSON.parse(String(init?.body)).size === 1 ? ok(opts.lookup ?? lookupHit) : ok(newcomersRes);
    }),
  );
  return calls;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsonOf = async (r: Response) => (await r.json()) as any;
const get = (path: string, e: Env = env) => worker.fetch(new Request(`https://barhack.test${path}`), e);

afterEach(() => vi.unstubAllGlobals());

describe('GET /', () => {
  it('serves the page with a nonce-based CSP', async () => {
    const res = await get('/');
    const html = await res.text();
    const nonce = /script-src 'nonce-([^']+)'/.exec(res.headers.get('content-security-policy') ?? '')?.[1];
    expect(res.status).toBe(200);
    expect(nonce).toBeTruthy();
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(html).toContain('Barhack');
  });
});

describe('GET /block', () => {
  it('returns a bilingual brief and shows its work', async () => {
    const calls = stubFetch();
    const res = await get('/block?name=Test%20Bar');
    const text = await res.text();
    const body = JSON.parse(text);

    expect(res.status).toBe(200);
    expect(body.brief).toEqual(brief);
    expect(body.bar).toEqual({ name: 'Test Bar', address: '1 Main St' });
    expect(body.how.mistral.model).toBe(MISTRAL_MODEL);
    expect(body.how.elasticsearch.map((s: { step: string }) => s.step)).toEqual(['lookup', 'trouble', 'newcomers']);

    // Elasticsearch gets the key in the Authorization header only. Mistral gets json_object mode.
    const es = calls.filter((c) => c.url.startsWith('https://es.example.test/'));
    expect(es).toHaveLength(3);
    for (const c of es) expect((c.init?.headers as Record<string, string>).authorization).toBe('ApiKey fake-elastic-key-for-tests');
    const mistral = calls.find((c) => c.url.startsWith('https://api.mistral.ai/'))!;
    const sent = JSON.parse(String(mistral.init?.body));
    expect(sent.model).toBe('mistral-small-latest');
    expect(sent.response_format).toEqual({ type: 'json_object' });
    expect(String(mistral.init?.body)).not.toContain('fake-');

    // No secret appears in anything the browser receives.
    expect(text).not.toContain('fake-elastic-key-for-tests');
    expect(text).not.toContain('fake-mistral-key-for-tests');
  });

  it('asks for a name', async () => {
    expect((await get('/block?name=%20')).status).toBe(400);
  });

  it('says so when the bar is not in the registry', async () => {
    stubFetch({ lookup: { hits: { hits: [] } } });
    const res = await get('/block?name=Nowhere');
    expect(res.status).toBe(404);
    expect((await jsonOf(res)).message.es).toContain('No encontramos');
  });

  it('returns 502 when Mistral sends something that is not the expected JSON', async () => {
    stubFetch({ mistral: () => completion('not json') });
    const res = await get('/block?name=Test%20Bar');
    const body = await jsonOf(res);
    expect(res.status).toBe(502);
    expect(body.service).toBe('mistral');
  });

  it('retries Mistral once on a 429', async () => {
    let n = 0;
    const calls = stubFetch({ mistral: () => (n++ === 0 ? new Response('slow down', { status: 429 }) : completion(JSON.stringify(brief))) });
    const res = await get('/block?name=Test%20Bar');
    expect(res.status).toBe(200);
    expect(calls.filter((c) => c.url.startsWith('https://api.mistral.ai/'))).toHaveLength(2);
  });

  it('names a missing binding without printing any value', async () => {
    const res = await get('/block?name=Test%20Bar', { ...env, ELASTIC_API_KEY: '' });
    const body = await jsonOf(res);
    expect(res.status).toBe(500);
    expect(body.missing).toEqual(['ELASTIC_API_KEY']);
  });
});

describe('Mistral helpers', () => {
  it('accepts a full brief and rejects a short one', () => {
    expect(validateBrief(brief)).toEqual(brief);
    expect(validateBrief({ ...brief, es: { bullets: ['uno', 'dos'], action: 'Haz esto' } })).toBeNull();
    expect(validateBrief({ en: brief.en })).toBeNull();
  });

  it('reads JSON even inside a code fence', () => {
    expect(extractJson({ choices: [{ message: { content: '```json\n{"a":1}\n```' } }] })).toEqual({ a: 1 });
    expect(extractJson({})).toBeNull();
  });

  it('tells the model to use only the data and sends the data', () => {
    const data = { asOf: '2026-11-03', bar: { name: 'Test Bar', address: '1 Main St' }, trouble: { radiusM: 300, days: 30, total: 3, top: [] }, newcomers: { radiusM: 800, days: 365, total: 0, items: [] } };
    const [system, user] = buildMessages(data);
    expect(system?.content).toContain('ONLY');
    expect(user?.content).toContain('"Test Bar"');
  });
});
