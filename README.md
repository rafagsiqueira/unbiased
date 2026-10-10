# Unbiased

Brazilian-Portuguese news timeline with each article placed on a political scale
(-100 left … +100 right), scored by TypeSafe's **Jev** (System One) model.

- **Frontend:** Ionic React + Vite, localized (pt-BR only for now), Capacitor for iOS/Android.
- **Backend:** Vercel functions in `api/`. A cron-driven **ingestion job** pulls the RSS feeds, scores new
  articles with Jev and stores them in Postgres. The public API only *reads* stored, already-scored
  articles; there is no scoring endpoint, and the TypeSafe key never leaves the server.

```
Vercel Cron ──▶ /api/cron/ingest ──▶ fetch feeds ─▶ insert new ─▶ score unscored (Jev) ─▶ prune
                                                         │                │
                                                         ▼                ▼
App ──▶ GET /api/articles?country&language[&category][&feed][&cursor] ──▶ Postgres (articles)
```

## Layout

| Path | Purpose |
| --- | --- |
| `api/_lib/feeds.ts` | Feed registry: outlet, URL, country, language, category. **Add feeds here.** |
| `api/_lib/jev.ts` | Scoring prompt (question + 5 levels), request builder, response → -100…+100 mapping |
| `api/_lib/pipeline.ts` | Ingestion: fetch → insert new → score (budgeted, retried ≤3×) → prune (30 days) |
| `api/_lib/store.ts` | Postgres store + schema (created automatically); Neon in prod, PGlite in dev/tests |
| `api/cron/ingest.ts` | Cron entrypoint, requires `Authorization: Bearer $CRON_SECRET` (fails closed) |
| `api/articles.ts` | `GET /api/articles`: date-ordered, cursor-paginated, filterable by category/feed |
| `api/feeds.ts` | `GET /api/feeds`: feeds, categories and available country/language markets |
| `src/` | Ionic app; strings in `src/i18n/pt-BR.json` |

## Run

```sh
npm install
cp .env.example .env.local   # set TYPESAFE_API_KEY
npm run dev                  # app + /api routes on :5173
npm test && npm run typecheck
```

Locally (no `DATABASE_URL`) the dev server uses an in-process Postgres (PGlite) and runs the
ingestion at startup and every 10 minutes. Without `TYPESAFE_API_KEY` articles are stored but
unscored; the app shows "Análise pendente".

## Deploy (Vercel)

1. Import the repo (framework preset: Vite).
2. Add a Postgres database from the Vercel Marketplace (Neon); it sets `DATABASE_URL`.
3. Set `TYPESAFE_API_KEY` and `CRON_SECRET` (any long random string; Vercel Cron sends it automatically).
4. `vercel.json` schedules the ingestion every 15 minutes. Sub-daily cron schedules need a Pro plan;
   on Hobby change the schedule to daily or trigger `/api/cron/ingest` from an external scheduler.

## Native

```sh
npm i -D @capacitor/android @capacitor/ios
npx cap add android   # and/or ios
VITE_API_BASE=https://<your-app>.vercel.app npm run cap:sync
```

Native builds need `VITE_API_BASE`, since `/api` isn't same-origin there.

## Scoring notes

The model sees only the article title + summary (not the outlet name) and one Score
question over 5 described levels (far left → far right). Its 0–4 score maps linearly to
-100…+100; the model's confidence is stored next to the value. Each run scores at most 60
unscored articles (newest first); failures are retried on later runs, up to 3 attempts.
Tune the prompt in `api/_lib/jev.ts` and check it against articles with known leanings.
Auth is sent as `Authorization: Bearer <key>` (assumed; confirm against the API reference).
Changing the prompt does not re-score stored articles; clear `bias_value` in the table to do that.
