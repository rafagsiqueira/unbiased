import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import createDOMPurify from 'dompurify';
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

export async function extractArticleText(html: string, url: string): Promise<string> {
  const dom = new JSDOM(html, { url });
  const sanitizer = createDOMPurify(dom.window as unknown as Window & typeof globalThis);
  const cleanHtml = sanitizer.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
  });
  const article = new Readability(new JSDOM(cleanHtml, { url }).window.document).parse();
  const text = article?.textContent ?? article?.excerpt ?? '';
  const normalised = stripHtml(text).replace(/\s+/g, ' ').trim();
  return normalised ? truncate(normalised, 1200) : '';
}

export async function fetchArticleSummary(link: string, fallback: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  try {
    const res = await fetchImpl(link, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    });
    if (!res.ok) return fallback;
    const html = await res.text();
    const extracted = await extractArticleText(html, link);
    return extracted || fallback;
  } catch {
    return fallback;
  }
}

export async function parseFeedXml(xml: string, feed: Feed): Promise<Article[]> {
  const parsed = await parser.parseString(xml);
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
  return parseFeedXml(await res.text(), feed);
}
