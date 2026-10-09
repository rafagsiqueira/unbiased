import type { BiasScore } from '../../shared/types';
import { scoreArticle } from './jev';

const TTL_MS = 7 * 24 * 3600 * 1000;
// Per-instance cache. Swap for Vercel KV / Upstash to share scores across instances.
const cache = new Map<string, { at: number; score: BiasScore }>();

export function getCached(id: string): BiasScore | null {
  const hit = cache.get(id);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(id);
    return null;
  }
  return hit.score;
}

export async function scoreMany(
  items: { id: string; title: string; summary: string }[],
  concurrency = 4,
  score: typeof scoreArticle = scoreArticle,
): Promise<Record<string, BiasScore | null>> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  const out: Record<string, BiasScore | null> = {};
  const queue = [...items];

  async function worker() {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const cached = getCached(item.id);
      if (cached) {
        out[item.id] = cached;
        continue;
      }
      if (!apiKey) {
        out[item.id] = null;
        continue;
      }
      try {
        const result = await score(item, {
          apiKey,
          url: process.env.TYPESAFE_API_URL,
          model: process.env.TYPESAFE_MODEL,
        });
        cache.set(item.id, { at: Date.now(), score: result });
        out[item.id] = result;
      } catch (err) {
        console.error(`scoring failed for ${item.id}:`, err);
        out[item.id] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}
