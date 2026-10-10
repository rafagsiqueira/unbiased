import { createHash } from 'node:crypto';
import Parser from 'rss-parser';
import type { Article, Feed } from '../../shared/types';

const parser = new Parser();

const USER_AGENT = 'Mozilla/5.0 (compatible; UnbiasedBot/0.1)';

export function stripHtml(input: string | undefined): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function articleId(link: string): string {
  return createHash('sha1').update(link).digest('hex').slice(0, 16);
}

export function decodeXmlText(input: string | ArrayBuffer | Uint8Array, contentType?: string | null): string {
  if (typeof input === 'string') return input;

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length === 0) return '';

  const snippet = Buffer.from(bytes.slice(0, 512)).toString('latin1');
  const xmlEncoding = snippet.match(/<\?xml[^>]*encoding=["']?([A-Za-z0-9._-]+)["']?/i)?.[1];
  const headerEncoding = contentType?.match(/charset=([^;]+)/i)?.[1]?.trim().replace(/["']/g, '');
  const encoding = xmlEncoding ?? headerEncoding ?? 'utf-8';

  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export async function parseFeedXml(xml: string | ArrayBuffer | Uint8Array, feed: Feed, contentType?: string | null): Promise<Article[]> {
  const parsed = await parser.parseString(decodeXmlText(xml, contentType));
  const articles: Article[] = [];
  for (const item of parsed.items) {
    const link = item.link?.trim();
    const title = stripHtml(item.title);
    const date = new Date(item.isoDate ?? item.pubDate ?? '');
    if (!link || !title || Number.isNaN(date.getTime())) continue;
    articles.push({
      id: articleId(link),
      feedId: feed.id,
      outlet: feed.outlet,
      category: feed.category,
      country: feed.country,
      language: feed.language,
      title,
      summary: truncate(stripHtml(item.contentSnippet ?? item.content ?? item.summary), 400),
      link,
      publishedAt: date.toISOString(),
      image: item.enclosure?.url,
    });
  }
  return articles;
}

export async function fetchFeed(feed: Feed, fetchImpl: typeof fetch = fetch): Promise<Article[]> {
  const res = await fetchImpl(feed.url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(8000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${feed.id}: HTTP ${res.status}`);
  return parseFeedXml(await res.arrayBuffer(), feed, res.headers.get('content-type'));
}
