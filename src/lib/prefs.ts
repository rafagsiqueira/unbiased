import type { CategoryId } from '../../shared/types';

export type ColumnId = 'journalism' | 'sports' | 'entertainment';

export const NEWS_COLUMN_GROUPS: Record<ColumnId, CategoryId[]> = {
  journalism: ['politics', 'world', 'economy', 'general'],
  sports: ['sports'],
  entertainment: ['opinion', 'tech', 'culture'],
};

export const DEFAULT_COLUMNS: ColumnId[] = ['journalism', 'sports', 'entertainment'];

export interface Prefs {
  country: string;
  language: string;
  /** Feed ids the user switched off. */
  hiddenFeeds: string[];
  /** Column groups shown on the web desktop layout. */
  columns: ColumnId[];
}

const KEY = 'unbiased.prefs';
const DEFAULTS: Prefs = { country: 'BR', language: 'pt-BR', hiddenFeeds: [], columns: [...DEFAULT_COLUMNS] };

function normalizeColumns(value: unknown): ColumnId[] {
  if (!Array.isArray(value)) return [...DEFAULT_COLUMNS];
  const selected = value.filter((item): item is ColumnId => typeof item === 'string' && Object.prototype.hasOwnProperty.call(NEWS_COLUMN_GROUPS, item));
  return selected.length ? selected : [...DEFAULT_COLUMNS];
}

export function loadPrefs(): Prefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    return {
      ...DEFAULTS,
      ...parsed,
      hiddenFeeds: Array.isArray(parsed.hiddenFeeds) ? parsed.hiddenFeeds.filter((id): id is string => typeof id === 'string') : DEFAULTS.hiddenFeeds,
      columns: normalizeColumns(parsed.columns),
    };
  } catch {
    return DEFAULTS;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: preferences just won't persist */
  }
}
