import { UpstreamError, type Env } from './env';

/** POST <ELASTIC_URL>/<index>/_search. The API key is only ever sent in the Authorization header. */
export async function esSearch(env: Env, index: string, body: unknown): Promise<unknown> {
  const base = env.ELASTIC_URL.replace(/\/+$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}/${encodeURIComponent(index)}/_search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `ApiKey ${env.ELASTIC_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new UpstreamError('elasticsearch', 0, 'network error or timeout');
  }
  const raw = await res.text();
  if (!res.ok) throw new UpstreamError('elasticsearch', res.status, raw.slice(0, 300));
  try {
    return JSON.parse(raw);
  } catch {
    throw new UpstreamError('elasticsearch', 502, 'response was not JSON');
  }
}
