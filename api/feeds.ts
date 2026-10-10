import type { FeedsResponse } from '../shared/types';
import { CATEGORIES, FEEDS, listMarkets } from './_lib/feeds.js';

export async function GET(): Promise<Response> {
  const body: FeedsResponse = {
    feeds: FEEDS,
    categories: CATEGORIES,
    countries: listMarkets(),
  };
  return Response.json(body, { headers: { 'cache-control': 'public, s-maxage=3600' } });
}
