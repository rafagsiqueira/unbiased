export type CategoryId =
  | 'politics'
  | 'world'
  | 'economy'
  | 'general'
  | 'opinion'
  | 'sports'
  | 'tech'
  | 'culture';

export interface Feed {
  id: string;
  outlet: string;
  url: string;
  /** ISO 3166-1 alpha-2, e.g. "BR" */
  country: string;
  /** BCP 47, e.g. "pt-BR" */
  language: string;
  category: CategoryId;
}

export interface Article {
  id: string;
  feedId: string;
  outlet: string;
  category: CategoryId;
  country: string;
  language: string;
  title: string;
  summary: string;
  link: string;
  /** ISO 8601 */
  publishedAt: string;
  image?: string;
}

export interface BiasScore {
  /** -100 (left) … +100 (right) */
  value: number;
  /** 0 … 1, as reported by the model */
  confidence: number;
}

export interface FeedsResponse {
  feeds: Feed[];
  categories: CategoryId[];
  countries: { country: string; language: string }[];
}

export interface ArticlesResponse {
  articles: (Article & { bias: BiasScore | null })[];
  failedFeeds: string[];
}

export interface ScoreRequest {
  articles: { id: string; title: string; summary: string }[];
}

export interface ScoreResponse {
  scores: Record<string, BiasScore | null>;
}
