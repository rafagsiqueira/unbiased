import type { BiasScore } from '../../shared/types';

export const DEFAULT_URL = 'https://api.typesafe.ai/v1/systemone';
export const DEFAULT_MODEL = 'jev-latest';
export const QUESTION_ID = 'political_lean';

/**
 * Levels run from far left (index 0) to far right (last index). The model only
 * sees these descriptions, never the numbers, so each one describes a concrete
 * situation. Content is Brazilian Portuguese to match the articles.
 */
export const CRITERIA = [
  'Enquadramento claramente de esquerda: adota o vocabulário e as premissas de movimentos de esquerda, defende expansão do papel do Estado, redistribuição de renda ou pautas progressistas, e critica de forma enfática o mercado, a direita ou o conservadorismo.',
  'Inclinação moderada à esquerda: o texto é em geral factual, mas escolhe fontes, adjetivos ou destaques que favorecem governos e pautas de esquerda, ou que enfatizam críticas à direita e ao mercado.',
  'Neutro: relata fatos com fontes de diferentes lados, sem juízo de valor nem adjetivação política; ou trata de assunto sem dimensão política.',
  'Inclinação moderada à direita: o texto é em geral factual, mas escolhe fontes, adjetivos ou destaques que favorecem o mercado, a redução do Estado ou pautas conservadoras, ou que enfatizam críticas à esquerda e a governos de esquerda.',
  'Enquadramento claramente de direita: adota o vocabulário e as premissas de movimentos de direita, defende livre mercado, Estado mínimo ou valores conservadores, e critica de forma enfática a esquerda, o governo de esquerda ou pautas progressistas.',
];

export const INSTRUCTIONS =
  'Em que ponto do espectro político brasileiro, da esquerda à direita, se posiciona o enquadramento deste texto jornalístico? ' +
  'Considere a escolha de palavras, o que é destacado e quem é criticado ou elogiado. ' +
  'Avalie a inclinação do texto, não o assunto: noticiar um escândalo de um governo de esquerda ou de direita de forma factual é neutro.';

export interface JevConfig {
  apiKey: string;
  url?: string;
  model?: string;
}

export function buildRequest(article: { title: string; summary: string }, model = DEFAULT_MODEL) {
  // The outlet name is deliberately left out so scores reflect the text, not the brand.
  const state = [article.title, article.summary].filter(Boolean).join('\n\n');
  return {
    model,
    state,
    questions: {
      [QUESTION_ID]: { type: 'score', instructions: INSTRUCTIONS, criteria: CRITERIA },
    },
  };
}

/** Maps a 0…(levels-1) score onto -100…+100. */
export function toBiasScore(score: number, confidence: number, levels = CRITERIA.length): BiasScore {
  const top = levels - 1;
  const clamped = Math.min(Math.max(score, 0), top);
  return {
    value: Math.round((clamped / top) * 200 - 100),
    confidence: Math.min(Math.max(confidence, 0), 1),
  };
}

export function parseResponse(body: unknown): BiasScore {
  const answer = (body as { answers?: Record<string, { type?: string; score?: number; confidence?: number }> })?.answers?.[QUESTION_ID];
  if (!answer || answer.type !== 'score' || typeof answer.score !== 'number') {
    throw new Error('Unexpected TypeSafe response shape');
  }
  return toBiasScore(answer.score, answer.confidence ?? 0);
}

export async function scoreArticle(
  article: { title: string; summary: string },
  config: JevConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<BiasScore> {
  const res = await fetchImpl(config.url ?? DEFAULT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(buildRequest(article, config.model)),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`TypeSafe API HTTP ${res.status}`);
  return parseResponse(await res.json());
}
