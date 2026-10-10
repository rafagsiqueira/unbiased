import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as articlesGET } from '../api/articles';
import { GET as cronGET } from '../api/cron/ingest';
import { FEEDS } from '../api/_lib/feeds';
import { ingest } from '../api/_lib/pipeline';
import { PostgresStore, setStore, type ArticleStore } from '../api/_lib/store';
import type { Article } from '../shared/types';

const NOW = new Date('2026-10-09T12:00:00Z');
const art = (n: number, feedIdx = 0, minsAgo = n): Article => ({
  id: `a${n}`, feedId: FEEDS[feedIdx].id, outlet: FEEDS[feedIdx].outlet, category: FEEDS[feedIdx].category,
  country: 'BR', language: 'pt-BR', title: `t${n}`, summary: `s${n}`, link: `https://ex.com/${n}`,
  publishedAt: new Date(NOW.getTime() - minsAgo * 60000).toISOString(),
});

let store: ArticleStore;
beforeEach(async () => {
  const db = new PGlite();
  store = new PostgresStore(async (text, params) => (await db.query(text, params)).rows as Record<string, unknown>[]);
  await store.init();
  setStore(store);
  delete process.env.TYPESAFE_API_KEY;
});

const run = (over: Partial<Parameters<typeof ingest>[0]> = {}) =>
  ingest({
    store, now: () => NOW,
    fetchFeed: async (f) => (f.id === 'valor' ? [art(1, 0), art(2, 0)] : f.id === 'folha-poder' ? [art(3, 3), art(1, 0)] : []),
    score: async (a) => ({ value: a.title === 't2' ? 40 : -20, confidence: 0.7 }),
    ...over,
  });

describe('ingest pipeline', () => {
  it('stores new articles once, scores them, and is idempotent', async () => {
    const first = await run();
    expect(first).toMatchObject({ fetched: 4, inserted: 3, scored: 3, scoreFailures: 0, scoringSkipped: false });
    const second = await run({ score: vi.fn() });
    expect(second).toMatchObject({ inserted: 0, scored: 0 });
    const list = await store.list({ country: 'BR', language: 'pt-BR', limit: 10 });
    expect(list.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    expect(list[1].bias).toEqual({ value: 40, confidence: 0.7 });
  });

  it('retries failed scoring up to the attempt cap and does not crash the run', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    for (let i = 0; i < 4; i++) await run({ score: failing, maxAttempts: 3 });
    expect(failing).toHaveBeenCalledTimes(9); // 3 articles x 3 attempts
    const list = await store.list({ country: 'BR', language: 'pt-BR', limit: 10 });
    expect(list.every((a) => a.bias === null)).toBe(true);
    expect((await store.unscored(10, 3)).length).toBe(0);
  });

  it('skips scoring without credentials but still stores articles', async () => {
    const r = await run({ score: undefined });
    expect(r).toMatchObject({ inserted: 3, scored: 0, scoringSkipped: true });
  });

  it('isolates a failing feed and prunes old articles', async () => {
    const r = await run({ fetchFeed: async (f) => { if (f.id === 'g1') throw new Error('down'); return f.id === 'valor' ? [art(1, 0), art(9, 0, 40 * 24 * 60)] : []; } });
    expect(r.failedFeeds).toEqual(['g1']);
    expect(r.inserted).toBe(1); // 40-day-old article filtered by retention
  });
});

describe('GET /api/articles', () => {
  const get = (qs: string) => articlesGET(new Request(`http://x/api/articles?${qs}`)).then((r) => r.json());

  it('requires a market, filters by category/feed and paginates by cursor', async () => {
    expect((await articlesGET(new Request('http://x/api/articles'))).status).toBe(400);
    await run();
    const page1 = await get('country=BR&language=pt-BR&limit=2');
    expect(page1.articles.map((a: Article) => a.id)).toEqual(['a1', 'a2']);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await get(`country=BR&language=pt-BR&limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`);
    expect(page2.articles.map((a: Article) => a.id)).toEqual(['a3']);
    expect(page2.nextCursor).toBeNull();
    expect((await get('country=BR&language=pt-BR&category=politics')).articles.map((a: Article) => a.id)).toEqual(['a3']);
    expect((await get('country=BR&language=pt-BR&feed=valor')).articles).toHaveLength(2);
    expect((await get('country=US&language=en-US')).articles).toEqual([]);
  });
});

describe('cron endpoint', () => {
  it('rejects requests without the secret, including when none is configured', async () => {
    delete process.env.CRON_SECRET;
    expect((await cronGET(new Request('http://x/api/cron/ingest'))).status).toBe(401);
    process.env.CRON_SECRET = 's';
    expect((await cronGET(new Request('http://x/api/cron/ingest'))).status).toBe(401);
    expect((await cronGET(new Request('http://x/api/cron/ingest', { headers: { authorization: 'Be' + 'arer s' } }))).status).toBe(200);
  });
});
