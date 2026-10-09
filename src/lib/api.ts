import type { ArticlesResponse, FeedsResponse } from '../../shared/types';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const fetchFeeds = () => json<FeedsResponse>('/api/feeds');

export interface ArticleQuery {
  country: string;
  language: string;
  category?: string;
  /** Restrict to these feed ids (omit for all). */
  feeds?: string[];
  cursor?: string | null;
}

export const fetchArticles = (q: ArticleQuery) => {
  const params = new URLSearchParams({ country: q.country, language: q.language });
  if (q.category) params.set('category', q.category);
  if (q.feeds) params.set('feed', q.feeds.join(','));
  if (q.cursor) params.set('cursor', q.cursor);
  return json<ArticlesResponse>(`/api/articles?${params}`);
};
