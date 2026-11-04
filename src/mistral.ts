import { UpstreamError, type Env } from './env';
import type { BlockData } from './queries';

export const MISTRAL_MODEL = 'mistral-small-latest';
export const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';

export interface BriefLang {
  bullets: string[];
  action: string;
}
export interface Brief {
  en: BriefLang;
  es: BriefLang;
}

const SYSTEM_PROMPT = [
  'You advise a San Francisco bar owner.',
  'Use ONLY the JSON data the user sends. Do not invent names, numbers, events or causes. If the data is thin, say so plainly.',
  'Write exactly 3 short bullets about what is happening on their block, then 1 concrete action for this week (for example an event, a promo, or a 311 report to file).',
  'Never promise revenue, sales or more customers. Plain and friendly, no hype. Keep each bullet and the action under 25 words.',
  'Return ONLY JSON shaped like {"en":{"bullets":["","",""],"action":""},"es":{"bullets":["","",""],"action":""}}.',
  'The es object is natural Spanish for a Spanish-speaking bar owner in San Francisco, with the same meaning as en.',
].join(' ');

export function buildMessages(data: BlockData) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Block data (public SF open data):\n${JSON.stringify(data)}` },
  ];
}

export function buildMistralBody(data: BlockData) {
  return {
    model: MISTRAL_MODEL,
    messages: buildMessages(data),
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 700,
  };
}

const clean = (s: unknown): string => (typeof s === 'string' ? s.trim().slice(0, 400) : '');

function lang(x: unknown): BriefLang | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as { bullets?: unknown; action?: unknown };
  if (!Array.isArray(o.bullets)) return null;
  const bullets = o.bullets.map(clean).filter(Boolean);
  const action = clean(o.action);
  if (bullets.length < 3 || !action) return null;
  return { bullets: bullets.slice(0, 3), action };
}

/** Accept the model's JSON only if both languages have 3 bullets and an action. */
export function validateBrief(x: unknown): Brief | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as { en?: unknown; es?: unknown };
  const en = lang(o.en);
  const es = lang(o.es);
  return en && es ? { en, es } : null;
}

/** Pull the JSON out of a chat completion, tolerating a ```json fence or chunked content. */
export function extractJson(completion: unknown): unknown {
  const choice = (completion as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0];
  let content = choice?.message?.content;
  if (Array.isArray(content)) {
    content = content.map((c) => (typeof c === 'string' ? c : ((c as { text?: string })?.text ?? ''))).join('');
  }
  if (typeof content !== 'string') return null;
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One call to Mistral chat completions, retried once on 429 or 5xx. */
export async function generateBrief(env: Env, data: BlockData): Promise<Brief> {
  const body = JSON.stringify(buildMistralBody(data));
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(MISTRAL_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.MISTRAL_API_KEY}` },
        body,
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new UpstreamError('mistral', 0, 'network error or timeout');
    }
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await sleep(1200);
      continue;
    }
    const raw = await res.text();
    if (!res.ok) throw new UpstreamError('mistral', res.status, raw.slice(0, 300));
    let completion: unknown;
    try {
      completion = JSON.parse(raw);
    } catch {
      throw new UpstreamError('mistral', 502, 'response was not JSON');
    }
    const brief = validateBrief(extractJson(completion));
    if (!brief) throw new UpstreamError('mistral', 502, 'model did not return the expected JSON');
    return brief;
  }
  throw new UpstreamError('mistral', 502, 'no response');
}
