import type { Article, ArticlesResponse } from '../shared/types';
import { FEEDS } from './_lib/feeds';
import { fetchFeed } from './_lib/rss';
import { getCached } from './_lib/scoring';

const MAX_ARTICLES = 150;

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const country = params.get('country');
  const language = params.get('language');
  const categories = params.get('category')?.split(',').filter(Boolean);
  const outlets = params.get('feed')?.split(',').filter(Boolean);

  const feeds = FEEDS.filter(
    (f) =>
      (!country || f.country === country) &&
      (!language || f.language === language) &&
      (!categories?.length || categories.includes(f.category)) &&
      (!outlets?.length || outlets.includes(f.id)),
  );

  const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f)));
  const failedFeeds: string[] = [];
  const byLink = new Map<string, Article>();
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`feed ${feeds[i].id} failed:`, r.reason);
      failedFeeds.push(feeds[i].id);
      return;
    }
    for (const a of r.value) if (!byLink.has(a.link)) byLink.set(a.link, a);
  });

  const articles = [...byLink.values()]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_ARTICLES)
    .map((a) => ({ ...a, bias: getCached(a.id) }));

  const body: ArticlesResponse = { articles, failedFeeds };
  return Response.json(body, {
    headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
