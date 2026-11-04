# Barhack

Barhack is a weekly bilingual (English and Spanish) block brief for SF bars and restaurants, built from SF 311 and business data with Elastic and Mistral, by Venue AI.

An owner types their bar's name and gets 3 bullets about their block plus 1 action for this week. A Cloudflare Worker finds the bar in Elasticsearch, runs two geo queries (311 problems within 300 m in the last 30 days, places opened within 800 m in the last year), and Mistral Small writes the brief. The "How it works" panel on the page shows the exact queries.

## Repo map

| Path | What |
|---|---|
| `AGENTS.md` | Rules for agents (follows Rick-Pro/mission-control) |
| `docs/hack-night-requirements.md` | Hack night rules, judging criteria, starter data |
| `src/fields.ts` | Every index and field name. Lines marked `CHECK` need the real mapping |
| `src/queries.ts` | Query builders and response parsers (pure, tested) |
| `src/elastic.ts`, `src/mistral.ts` | The two API clients |
| `src/page.ts` | The one mobile page (EN/ES toggle) |
| `src/index.ts` | Worker routes: `/`, `GET /block?name=`, `/healthz` |
| `test/` | Offline Vitest tests, no network |

## Develop

```bash
npm install
npm test            # offline, no network needed
npm run typecheck
cp .dev.vars.example .dev.vars   # then fill in real values, never commit them
npx wrangler dev
```

## Deploy

```bash
npx wrangler secret put ELASTIC_URL
npx wrangler secret put ELASTIC_API_KEY
npx wrangler secret put MISTRAL_API_KEY
npx wrangler deploy
```

Secrets are Worker bindings, by name only: `ELASTIC_URL`, `ELASTIC_API_KEY`, `MISTRAL_API_KEY`. `CLOUDFLARE_API_TOKEN` is for CI deploys. No secret values in code, tests, docs or logs.

## Data

Public SF open data (311 Cases and Registered Business Locations from data.sf.gov), loaded into Elasticsearch with the hack night starter notebooks. See `docs/hack-night-requirements.md`.
