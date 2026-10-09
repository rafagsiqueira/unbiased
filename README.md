# Unbiased

Brazilian-Portuguese news timeline with each article placed on a political scale
(-100 left … +100 right), scored by TypeSafe's **Jev** (System One) model.

- **Frontend:** Ionic React + Vite, localized (pt-BR only for now), Capacitor for iOS/Android.
- **Backend:** Vercel functions in `api/` (web-standard `GET`/`POST` handlers). The TypeSafe key never reaches the client.

## Layout

| Path | Purpose |
| --- | --- |
| `api/_lib/feeds.ts` | Feed registry: outlet, URL, country, language, category. **Add feeds here.** |
| `api/_lib/jev.ts` | Scoring prompt (question + 5 levels), request builder, response → -100…+100 mapping |
| `api/_lib/scoring.ts` | Concurrency-limited scoring with an in-memory cache |
| `api/articles.ts` | `GET /api/articles?country=BR&language=pt-BR[&category=][&feed=]`, merged and date-sorted |
| `api/score.ts` | `POST /api/score` scores up to 20 `{id,title,summary}` |
| `api/feeds.ts` | `GET /api/feeds` feeds, categories and available country/language markets |
| `src/` | Ionic app; strings in `src/i18n/pt-BR.json` |

## Run

```sh
npm install
cp .env.example .env.local   # set TYPESAFE_API_KEY
npm run dev                  # app + /api routes on :5173
npm test && npm run typecheck
```

Without `TYPESAFE_API_KEY` articles load and the scale shows "Sem análise".

## Deploy

Import the repo in Vercel (framework preset: Vite) and set `TYPESAFE_API_KEY`.

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
-100…+100; the model's confidence is shown next to the value. Tune the prompt in
`api/_lib/jev.ts` and check it against articles with known leanings.
Auth is sent as `Authorization: Bearer <key>` (assumed; confirm against the API reference).
