import type { Article, BiasScore, Feed } from '../../shared/types';
import { FEEDS } from './feeds.js';
import { scoreArticle } from './jev.js';
import { fetchFeed } from './rss.js';
import type { ArticleStore } from './store';

export interface IngestDeps {
  store: ArticleStore;
  feeds?: Feed[];
  fetchFeed?: (feed: Feed) => Promise<Article[]>;
  score?: (article: { title: string; summary: string }) => Promise<BiasScore>;
  /** Max articles to score per run, newest first; the rest wait for the next run. */
  scoreBudget?: number;
  maxAttempts?: number;
  concurrency?: number;
  retentionDays?: number;
  now?: () => Date;
}

export interface IngestResult {
  fetched: number;
  inserted: number;
  scored: number;
  scoreFailures: number;
  failedFeeds: string[];
  pruned: number;
  scoringSkipped: boolean;
}

export async function ingest(deps: IngestDeps): Promise<IngestResult> {
  const { store } = deps;
  const feeds = deps.feeds ?? FEEDS;
  const load = deps.fetchFeed ?? ((f: Feed) => fetchFeed(f));
  const apiKey = process.env.TYPESAFE_API_KEY;
  const score =
    deps.score ??
    (apiKey
      ? (a: { title: string; summary: string }) =>
          scoreArticle(a, { apiKey, url: process.env.TYPESAFE_API_URL, model: process.env.TYPESAFE_MODEL })
      : null);
  const now = (deps.now ?? (() => new Date()))();

  const failedFeeds: string[] = [];
  const settled = await Promise.allSettled(feeds.map(load));
  const articles: Article[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') articles.push(...r.value);
    else {
      console.error(`feed ${feeds[i].id} failed:`, r.reason);
      failedFeeds.push(feeds[i].id);
    }
  });

  const retention = new Date(now.getTime() - (deps.retentionDays ?? 30) * 86400_000);
  const fresh = articles.filter((a) => new Date(a.publishedAt) >= retention);
  const inserted = await store.insertNew(fresh);

  let scored = 0;
  let scoreFailures = 0;
  if (score) {
    const queue = await store.unscored(deps.scoreBudget ?? 60, deps.maxAttempts ?? 3);
    const worker = async () => {
      for (let a = queue.shift(); a; a = queue.shift()) {
        try {
          await store.saveScore(a.id, await score(a));
          scored++;
        } catch (err) {
          console.error(`scoring failed for ${a.id}:`, err);
          scoreFailures++;
          await store.recordScoreFailure(a.id);
        }
      }
    };
    await Promise.all(Array.from({ length: deps.concurrency ?? 4 }, worker));
  }

  const pruned = await store.prune(retention);
  return { fetched: articles.length, inserted, scored, scoreFailures, failedFeeds, pruned, scoringSkipped: !score };
}
