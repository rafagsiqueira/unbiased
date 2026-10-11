import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_COLUMNS, loadPrefs, savePrefs } from '../src/lib/prefs';

describe('prefs', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('uses journalism, sports and entertainment as the default web layout', () => {
    expect(loadPrefs().columns).toEqual(DEFAULT_COLUMNS);
  });

  it('preserves valid custom column order and falls back to defaults otherwise', () => {
    savePrefs({ country: 'BR', language: 'pt-BR', hiddenFeeds: [], columns: ['sports', 'journalism'] });
    expect(loadPrefs().columns).toEqual(['sports', 'journalism']);

    localStorage.setItem('unbiased.prefs', JSON.stringify({ country: 'BR', language: 'pt-BR', hiddenFeeds: [], columns: ['unknown'] }));
    expect(loadPrefs().columns).toEqual(DEFAULT_COLUMNS);
  });
});
