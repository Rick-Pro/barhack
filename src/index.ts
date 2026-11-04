import { esSearch } from './elastic';
import { missingBindings, UpstreamError, type Env } from './env';
import { INDEX } from './fields';
import { MISTRAL_MODEL, MISTRAL_URL, generateBrief } from './mistral';
import { renderPage } from './page';
import {
  buildBarLookup,
  buildNewcomersQuery,
  buildTroubleQuery,
  parseBarHit,
  parseNewcomers,
  parseTrouble,
  type BlockData,
} from './queries';

const MSG = {
  noName: { en: "Type your bar's name.", es: 'Escribe el nombre de tu bar.' },
  notFound: {
    en: 'We could not find that business. Try the name as it appears in the city registry.',
    es: 'No encontramos ese negocio. Prueba con el nombre como aparece en el registro de la ciudad.',
  },
  upstream: {
    en: 'Something went wrong preparing your brief. Try again in a moment.',
    es: 'Algo salió mal al preparar tu resumen. Inténtalo de nuevo en un momento.',
  },
  config: {
    en: 'The server is missing a setting. Tell the Barhack team.',
    es: 'Al servidor le falta una configuración. Avisa al equipo de Barhack.',
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Today's date in San Francisco (YYYY-MM-DD), for the "as of" line. */
function todayInSF(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function handleBlock(url: URL, env: Env): Promise<Response> {
  const name = (url.searchParams.get('name') ?? '').trim().slice(0, 100);
  if (!name) return json({ error: 'missing_name', message: MSG.noName }, 400);

  const missing = missingBindings(env);
  if (missing.length) {
    console.error(`missing bindings: ${missing.join(', ')}`);
    return json({ error: 'misconfigured', missing, message: MSG.config }, 500);
  }

  try {
    const lookupBody = buildBarLookup(name);
    const bar = parseBarHit(await esSearch(env, INDEX.businesses, lookupBody));
    if (!bar) return json({ error: 'not_found', message: MSG.notFound }, 404);

    const troubleBody = buildTroubleQuery(bar.location);
    const newcomersBody = buildNewcomersQuery(bar.location, bar.id);
    const [troubleRes, newcomersRes] = await Promise.all([
      esSearch(env, INDEX.cases, troubleBody),
      esSearch(env, INDEX.businesses, newcomersBody),
    ]);

    const data: BlockData = {
      asOf: todayInSF(),
      bar: { name: bar.name, address: bar.address },
      trouble: parseTrouble(troubleRes),
      newcomers: parseNewcomers(newcomersRes),
    };
    const brief = await generateBrief(env, data);

    return json({
      bar: data.bar,
      asOf: data.asOf,
      data,
      brief,
      how: {
        elasticsearch: [
          { step: 'lookup', index: INDEX.businesses, body: lookupBody },
          { step: 'trouble', index: INDEX.cases, body: troubleBody },
          { step: 'newcomers', index: INDEX.businesses, body: newcomersBody },
        ],
        mistral: { model: MISTRAL_MODEL, endpoint: MISTRAL_URL, response_format: 'json_object' },
      },
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      console.error(`${err.service} ${err.status}: ${err.detail}`);
      return json(
        {
          error: 'upstream_error',
          service: err.service,
          upstreamStatus: err.status,
          detail: err.detail,
          message: MSG.upstream,
        },
        502,
      );
    }
    console.error('unexpected error:', err instanceof Error ? err.message : String(err));
    return json({ error: 'server_error', message: MSG.upstream }, 500);
  }
}

function pageResponse(): Response {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  return new Response(renderPage(nonce), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    if (url.pathname === '/') return pageResponse();
    if (url.pathname === '/block') return handleBlock(url, env);
    if (url.pathname === '/healthz') return json({ ok: true });
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
