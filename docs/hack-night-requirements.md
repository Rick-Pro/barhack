# Hack night requirements

Make SF Better: Mistral + Elastic hack night, Nov 3, 2026, Elastic SF office. Docs only. All project code is written during the event.

Sources: the host gist https://gist.github.com/jdarmada/1b24e6de84e332fb57e9ac41b27ece8a and the host repo https://github.com/jdarmada/elastic-mistral-hacknight (read Nov 3, 2026).

## Rules
- Up to 3 people per team.
- All implementation happens during the hack night. No confidential, sensitive or proprietary data. Public SF open data only.
- 7:30 PM initial judging: 2 minute pitch to judges, each judge picks their top 2 finalists.
- 8:00 PM finalists present, 3 minutes each, timed.
- 8:30 PM top 3 overall win Mistral credits.

## Judging (no weights published)
- Novelty: a unique idea, a novel use of the data, or an interesting technical approach.
- Use of Elastic: search, aggregations, geo, vector or semantic search. Agent Builder is a bonus, not required.
- Use of Mistral: its APIs, products, the Vibe CLI, or the AI behind them.
- The project needs both Elastic and Mistral.

## Demo must show
- Who it helps, what it does, how someone could use it.
- The Elastic part (queries, mappings, tools) and the Mistral part (which model, where).
- No polished UI needed. Work in progress is fine.

## Stack notes
- Elasticsearch Serverless 9.4 or newer.
- Mistral models: `mistral-small-latest`, `mistral-large-4`, `mistral-embed`.
- Secrets by name only: `ELASTIC_URL`, `ELASTIC_API_KEY`, `MISTRAL_API_KEY`, `CLOUDFLARE_API_TOKEN`.

## Starter data (host repo ingest notebooks)
Field names below come from reading the notebooks, not from running them. Check `GET <index>/_mapping` before writing queries.
- `sf_311_cases`: 311 Cases (vw6y-z8j6), last 60 days, up to 50,000 rows. Has `location` geo_point, `service_name`, `requested_at`.
- `sf_business_locations`: Registered Business Locations (g8m3-pdis), about 100,000 rows. Has `name`, `naics_code`, `location_start`, `location`.
- `sf_health_inspections`: Restaurant Health Inspections (tvy3-wexg), 2024 on.
- Also in the host repo: Muni, BART, street trees, parks and public art, landmarks, community events, City Nature Challenge.

## Mistral inside Elastic
See `using_mistral_in_elasticsearch.md` in the host repo: register `mistral-embed` and `mistral-large-4` with `PUT _inference`, then use `semantic_text` or call the chat endpoint. Optional.
