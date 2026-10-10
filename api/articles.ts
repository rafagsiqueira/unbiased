import type { ArticlesResponse } from '../shared/types';
import { getStore } from './_lib/store';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const list = (v: string | null) => v?.split(',').filter(Boolean);

export async function GET(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams;
  const country = p.get('country');
  const language = p.get('language');
  if (!country || !language) return Response.json({ error: 'country and language are required' }, { status: 400 });

  const limit = Math.min(Math.max(Number(p.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const store = await getStore();
  // Fetch one extra row to know whether another page exists.
  const rows = await store.list({
    country,
    language,
    categories: list(p.get('category')),
    feeds: list(p.get('feed')),
    cursor: p.get('cursor') ?? undefined,
    limit: limit + 1,
  });
  const articles = rows.slice(0, limit);
  const last = articles.at(-1);
  const body: ArticlesResponse = {
    articles,
    nextCursor: rows.length > limit && last ? `${last.publishedAt}|${last.id}` : null,
  };
  return Response.json(body, { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
