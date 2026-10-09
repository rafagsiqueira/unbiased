export interface Prefs {
  country: string;
  language: string;
  /** Feed ids the user switched off. */
  hiddenFeeds: string[];
}

const KEY = 'unbiased.prefs';
const DEFAULTS: Prefs = { country: 'BR', language: 'pt-BR', hiddenFeeds: [] };

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
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
