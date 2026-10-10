import { describe, expect, it } from 'vitest';
import { FEEDS } from '../api/_lib/feeds';
import { parseFeedXml, stripHtml } from '../api/_lib/rss';

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
  it('decodes ISO-8859-1 RSS payloads before parsing', async () => {
    const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
      <rss version="2.0"><channel><title>t</title>
      <item><title>Ministra do TSE tira do ar site com esquema de criptomoedas pr&aacute;-Fl&aacute;vio</title>
      <link>https://ex.com/c</link><pubDate>Fri, 09 Oct 2026 12:00:00 GMT</pubDate></item>
      </channel></rss>`;

    const list = await parseFeedXml(Buffer.from(xml, 'latin1'), FEEDS[3]);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Ministra do TSE tira do ar site com esquema de criptomoedas prá-Flávio');
  });
  it('every feed declares market and category', () => {
    for (const f of FEEDS) expect(f).toMatchObject({ country: expect.any(String), language: expect.any(String), category: expect.any(String) });
  });
});
