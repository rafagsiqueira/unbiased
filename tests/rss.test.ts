import { describe, expect, it } from 'vitest';
import { FEEDS } from '../api/_lib/feeds';
import { extractArticleText, fetchArticleSummary, parseFeedXml, stripHtml } from '../api/_lib/rss';

const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
<item><title>Lula &amp; Congresso</title><link>https://ex.com/a</link>
<description><![CDATA[<p>Resumo <b>da</b> matéria&nbsp;aqui</p>]]></description>
<pubDate>Fri, 09 Oct 2026 12:00:00 GMT</pubDate></item>
<item><title>Sem data</title><link>https://ex.com/b</link></item>
</channel></rss>`;

describe('rss', () => {
  it('parses items, strips html and skips undated ones', async () => {
    const list = await parseFeedXml(xml, FEEDS[3]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      title: 'Lula & Congresso',
      summary: 'Resumo da matéria aqui',
      category: 'politics',
      country: 'BR',
      publishedAt: '2026-10-09T12:00:00.000Z',
    });
  });
  it('strips entities', () => expect(stripHtml('<i>a</i>&nbsp;&amp;b')).toBe('a &b'));
  it('extracts readable article text and strips unsafe HTML', async () => {
    const html = `
      <html><head><title>Bad</title></head><body>
        <script>alert(1)</script>
        <article>
          <h1>Headline</h1>
          <p>First sentence.</p>
          <p><img src="x" onerror="alert(1)" alt="photo"> Second sentence.</p>
        </article>
      </body></html>`;
    const text = await extractArticleText(html, 'https://ex.com/article');
    expect(text).toContain('First sentence.');
    expect(text).toContain('Second sentence.');
    expect(text).not.toContain('alert(1)');
  });
  it('falls back to the RSS summary when article extraction cannot reach the page', async () => {
    const fallback = 'RSS summary';
    await expect(fetchArticleSummary('https://example.invalid/article', fallback, async () => {
      throw new Error('down');
    })).resolves.toBe(fallback);
  });
  it('every feed declares market and category', () => {
    for (const f of FEEDS) expect(f).toMatchObject({ country: expect.any(String), language: expect.any(String), category: expect.any(String) });
  });
});
