import type { ArticlesResponse, FeedsResponse, ScoreResponse } from '../../shared/types';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const fetchFeeds = () => json<FeedsResponse>('/api/feeds');

export const fetchArticles = (market: { country: string; language: string }) =>
  json<ArticlesResponse>(`/api/articles?${new URLSearchParams(market)}`);

export const scoreArticles = (articles: { id: string; title: string; summary: string }[]) =>
  json<ScoreResponse>('/api/score', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ articles }),
  });
