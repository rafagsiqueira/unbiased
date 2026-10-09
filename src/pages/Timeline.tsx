import {
  IonButton, IonButtons, IonChip, IonContent, IonHeader, IonIcon, IonInfiniteScroll,
  IonInfiniteScrollContent, IonLabel, IonPage, IonRefresher, IonRefresherContent, IonSpinner,
  IonTitle, IonToolbar,
} from '@ionic/react';
import { settingsOutline } from 'ionicons/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CategoryId, FeedsResponse, StoredArticle } from '../../shared/types';
import ArticleCard from '../components/ArticleCard';
import SettingsModal from '../components/SettingsModal';
import { fetchArticles, fetchFeeds } from '../lib/api';
import { loadPrefs, savePrefs, type Prefs } from '../lib/prefs';

export default function Timeline() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [catalog, setCatalog] = useState<FeedsResponse | null>(null);
  const [articles, setArticles] = useState<StoredArticle[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const generation = useRef(0); // drops responses from superseded queries

  useEffect(() => {
    fetchFeeds().then(setCatalog).catch(() => undefined);
  }, []);
  useEffect(() => savePrefs(prefs), [prefs]);

  // When outlets are switched off, send the enabled ones explicitly.
  const enabledFeeds = useMemo(() => {
    if (!prefs.hiddenFeeds.length) return undefined;
    if (!catalog) return null; // need the catalog to know what "enabled" means
    return catalog.feeds
      .filter((f) => f.country === prefs.country && f.language === prefs.language && !prefs.hiddenFeeds.includes(f.id))
      .map((f) => f.id);
  }, [catalog, prefs]);
  const feedsKey = enabledFeeds?.join(',');

  const query = useCallback(
    (next?: string | null) => ({
      country: prefs.country,
      language: prefs.language,
      category: category === 'all' ? undefined : category,
      feeds: enabledFeeds ?? undefined,
      cursor: next,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefs.country, prefs.language, category, feedsKey],
  );

  const reload = useCallback(async () => {
    if (enabledFeeds === null) return;
    const gen = ++generation.current;
    setError(false);
    try {
      const res = await fetchArticles(query());
      if (gen !== generation.current) return;
      setArticles(res.articles);
      setCursor(res.nextCursor);
    } catch {
      if (gen === generation.current) setError(true);
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, [query, enabledFeeds]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const loadMore = async () => {
    if (!cursor) return;
    const gen = generation.current;
    try {
      const res = await fetchArticles(query(cursor));
      if (gen !== generation.current) return;
      setArticles((prev) => [...prev, ...res.articles.filter((a) => !prev.some((p) => p.id === a.id))]);
      setCursor(res.nextCursor);
    } catch {
      setCursor(null);
    }
  };

  const categories = catalog?.categories.filter((c) => catalog.feeds.some((f) => f.category === c && f.country === prefs.country)) ?? [];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('app.title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label={t('settings.open')} onClick={() => setSettingsOpen(true)}>
              <IonIcon slot="icon-only" icon={settingsOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <div style={{ display: 'flex', overflowX: 'auto', padding: '0 8px' }} role="tablist">
            {(['all', ...categories] as const).map((c) => (
              <IonChip
                key={c}
                role="tab"
                aria-selected={category === c}
                color={category === c ? 'primary' : undefined}
                outline={category !== c}
                onClick={() => setCategory(c)}
              >
                <IonLabel>{t(`categories.${c}`)}</IonLabel>
              </IonChip>
            ))}
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await reload(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <IonSpinner />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <p>{t('timeline.error')}</p>
            <IonButton onClick={() => { setLoading(true); void reload(); }}>{t('timeline.retry')}</IonButton>
          </div>
        ) : articles.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32 }}>{t('timeline.empty')}</p>
        ) : (
          articles.map((a) => <ArticleCard key={a.id} article={a} />)
        )}

        <IonInfiniteScroll disabled={!cursor} onIonInfinite={async (e) => { await loadMore(); void e.target.complete(); }}>
          <IonInfiniteScrollContent />
        </IonInfiniteScroll>
      </IonContent>

      <SettingsModal
        open={settingsOpen}
        catalog={catalog}
        prefs={prefs}
        onChange={setPrefs}
        onClose={() => setSettingsOpen(false)}
      />
    </IonPage>
  );
}
