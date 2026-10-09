import type { CategoryId, Feed } from '../../shared/types';

/**
 * Registry of RSS feeds. Add a feed by appending an entry; country/language
 * drive the per-market filtering in the app.
 */
export const FEEDS: Feed[] = [
  { id: 'valor', outlet: 'Valor Econômico', url: 'http://pox.globo.com/rss/valor', country: 'BR', language: 'pt-BR', category: 'economy' },
  { id: 'g1', outlet: 'g1', url: 'https://g1.globo.com/dynamo/rss2.xml', country: 'BR', language: 'pt-BR', category: 'general' },
  { id: 'cnn-brasil', outlet: 'CNN Brasil', url: 'https://www.cnnbrasil.com.br/feed/', country: 'BR', language: 'pt-BR', category: 'general' },
  { id: 'folha-poder', outlet: 'Folha de S.Paulo', url: 'https://feeds.folha.uol.com.br/poder/rss091.xml', country: 'BR', language: 'pt-BR', category: 'politics' },
  { id: 'folha-mundo', outlet: 'Folha de S.Paulo', url: 'https://feeds.folha.uol.com.br/mundo/rss091.xml', country: 'BR', language: 'pt-BR', category: 'world' },
];

export const CATEGORIES: CategoryId[] = ['politics', 'world', 'economy', 'general', 'opinion', 'sports', 'tech', 'culture'];

export function listMarkets(feeds: Feed[] = FEEDS) {
  const seen = new Map<string, { country: string; language: string }>();
  for (const f of feeds) seen.set(`${f.country}:${f.language}`, { country: f.country, language: f.language });
  return [...seen.values()];
}
