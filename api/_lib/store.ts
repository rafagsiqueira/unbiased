import { neon } from '@neondatabase/serverless';
import type { Article, BiasScore, StoredArticle } from '../../shared/types';

export interface ListQuery {
  country: string;
  language: string;
  categories?: string[];
  feeds?: string[];
  /** Opaque cursor from a previous page: "<iso>|<id>" */
  cursor?: string;
  limit: number;
}

export interface ArticleStore {
  init(): Promise<void>;
  /** Inserts articles not seen before; returns how many were new. */
  insertNew(articles: Article[]): Promise<number>;
  /** Newest-first articles still lacking a score and under the attempt cap. */
  unscored(limit: number, maxAttempts: number): Promise<Article[]>;
  saveScore(id: string, score: BiasScore): Promise<void>;
  recordScoreFailure(id: string): Promise<void>;
  list(query: ListQuery): Promise<StoredArticle[]>;
  prune(olderThan: Date): Promise<number>;
}

/** Minimal SQL runner so the same store runs on Neon in prod and PGlite in tests. */
export type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS articles (
  id text PRIMARY KEY,
  link text NOT NULL UNIQUE,
  feed_id text NOT NULL,
  outlet text NOT NULL,
  category text NOT NULL,
  country text NOT NULL,
  language text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  image text,
  published_at timestamptz NOT NULL,
  bias_value integer,
  bias_confidence real,
  scored_at timestamptz,
  score_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS articles_market_published_idx ON articles (country, language, published_at DESC, id DESC);
`;

function toArticle(r: Record<string, unknown>): StoredArticle {
  return {
    id: r.id as string,
    feedId: r.feed_id as string,
    outlet: r.outlet as string,
    category: r.category as Article['category'],
    country: r.country as string,
    language: r.language as string,
    title: r.title as string,
    summary: r.summary as string,
    link: r.link as string,
    image: (r.image as string | null) ?? undefined,
    publishedAt: new Date(r.published_at as string | Date).toISOString(),
    bias:
      r.bias_value == null
        ? null
        : { value: Number(r.bias_value), confidence: Number(r.bias_confidence) },
  };
}

export function parseCursor(cursor?: string): { at: string; id: string } | null {
  const [at, id] = cursor?.split('|') ?? [];
  return at && id && !Number.isNaN(Date.parse(at)) ? { at, id } : null;
}

export class PostgresStore implements ArticleStore {
  constructor(private q: Query) {}

  async init() {
    for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await this.q(stmt);
  }

  async insertNew(articles: Article[]) {
    let inserted = 0;
    for (const a of articles) {
      const rows = await this.q(
        `INSERT INTO articles (id, link, feed_id, outlet, category, country, language, title, summary, image, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT DO NOTHING RETURNING id`,
        [a.id, a.link, a.feedId, a.outlet, a.category, a.country, a.language, a.title, a.summary, a.image ?? null, a.publishedAt],
      );
      inserted += rows.length;
    }
    return inserted;
  }

  async unscored(limit: number, maxAttempts: number) {
    const rows = await this.q(
      `SELECT * FROM articles WHERE bias_value IS NULL AND score_attempts < $1
       ORDER BY published_at DESC LIMIT $2`,
      [maxAttempts, limit],
    );
    return rows.map(toArticle);
  }

  async saveScore(id: string, score: BiasScore) {
    await this.q(
      `UPDATE articles SET bias_value=$2, bias_confidence=$3, scored_at=now() WHERE id=$1`,
      [id, score.value, score.confidence],
    );
  }

  async recordScoreFailure(id: string) {
    await this.q(`UPDATE articles SET score_attempts = score_attempts + 1 WHERE id=$1`, [id]);
  }

  async list(q: ListQuery) {
    const cursor = parseCursor(q.cursor);
    const rows = await this.q(
      `SELECT * FROM articles
       WHERE country=$1 AND language=$2
         AND ($3::text[] IS NULL OR category = ANY($3::text[]))
         AND ($4::text[] IS NULL OR feed_id = ANY($4::text[]))
         AND ($5::timestamptz IS NULL OR (published_at, id) < ($5::timestamptz, $6::text))
       ORDER BY published_at DESC, id DESC LIMIT $7`,
      [q.country, q.language, q.categories?.length ? q.categories : null, q.feeds?.length ? q.feeds : null, cursor?.at ?? null, cursor?.id ?? null, q.limit],
    );
    return rows.map(toArticle);
  }

  async prune(olderThan: Date) {
    const rows = await this.q(`DELETE FROM articles WHERE published_at < $1 RETURNING id`, [olderThan.toISOString()]);
    return rows.length;
  }
}

let instance: ArticleStore | undefined;

/** Production store: Postgres via DATABASE_URL (Neon). */
export async function getStore(): Promise<ArticleStore> {
  if (instance) return instance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = neon(url);
  const store = new PostgresStore((text, params) => sql.query(text, params ?? []) as Promise<Record<string, unknown>[]>);
  await store.init();
  instance = store;
  return store;
}

/** Test/dev hook. */
export function setStore(store: ArticleStore | undefined) {
  instance = store;
}
