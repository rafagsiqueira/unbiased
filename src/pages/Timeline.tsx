import {
  IonButton, IonButtons, IonChip, IonContent, IonHeader, IonIcon, IonInfiniteScroll,
  IonInfiniteScrollContent, IonLabel, IonPage, IonRefresher, IonRefresherContent, IonSpinner,
  IonText, IonTitle, IonToolbar,
} from '@ionic/react';
import { settingsOutline } from 'ionicons/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArticlesResponse, BiasScore, CategoryId, FeedsResponse } from '../../shared/types';
import ArticleCard from '../components/ArticleCard';
import SettingsModal from '../components/SettingsModal';
import { fetchArticles, fetchFeeds, scoreArticles } from '../lib/api';
import { loadPrefs, savePrefs, type Prefs } from '../lib/prefs';

const PAGE_SIZE = 20;
const SCORE_BATCH = 10;

type Article = ArticlesResponse['articles'][number];

export default function Timeline() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [catalog, setCatalog] = useState<FeedsResponse | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [failedFeeds, setFailedFeeds] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, BiasScore | null>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const requested = useRef(new Set<string>());

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetchArticles({ country: prefs.country, language: prefs.language });
      setArticles(res.articles);
      setFailedFeeds(res.failedFeeds);
      setScores((prev) => {
        const next = { ...prev };
        for (const a of res.articles) if (a.bias) next[a.id] = a.bias;
        return next;
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [prefs.country, prefs.language]);

  useEffect(() => {
    fetchFeeds().then(setCatalog).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => savePrefs(prefs), [prefs]);

  const filtered = useMemo(
    () =>
      articles.filter(
        (a) => (category === 'all' || a.category === category) && !prefs.hiddenFeeds.includes(a.feedId),
      ),
    [articles, category, prefs.hiddenFeeds],
  );
  const shown = filtered.slice(0, visible);

  useEffect(() => setVisible(PAGE_SIZE), [category, prefs]);

  // Score what's on screen, in small batches, without re-requesting.
  useEffect(() => {
    const todo = shown.filter((a) => !(a.id in scores) && !requested.current.has(a.id));
    for (let i = 0; i < todo.length; i += SCORE_BATCH) {
      const batch = todo.slice(i, i + SCORE_BATCH);
      batch.forEach((a) => requested.current.add(a.id));
      setPending((p) => new Set([...p, ...batch.map((a) => a.id)]));
      scoreArticles(batch.map(({ id, title, summary }) => ({ id, title, summary })))
        .then((res) => setScores((s) => ({ ...s, ...res.scores })))
        .catch(() => setScores((s) => ({ ...s, ...Object.fromEntries(batch.map((a) => [a.id, null])) })))
        .finally(() =>
          setPending((p) => {
            const next = new Set(p);
            batch.forEach((a) => next.delete(a.id));
            return next;
          }),
        );
    }
  }, [shown, scores]);

  const categories = useMemo(
    () => (catalog?.categories ?? []).filter((c) => articles.some((a) => a.category === c)),
    [catalog, articles],
  );

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
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await load(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        {failedFeeds.length > 0 && (
          <IonText color="medium">
            <p style={{ padding: '8px 16px', fontSize: '0.8rem', margin: 0 }}>
              {t('timeline.partial', { feeds: failedFeeds.join(', ') })}
            </p>
          </IonText>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <IonSpinner />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <p>{t('timeline.error')}</p>
            <IonButton onClick={() => { setLoading(true); void load(); }}>{t('timeline.retry')}</IonButton>
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32 }}>{t('timeline.empty')}</p>
        ) : (
          shown.map((a) => (
            <ArticleCard key={a.id} article={a} bias={scores[a.id] ?? a.bias} pending={pending.has(a.id)} />
          ))
        )}

        <IonInfiniteScroll
          disabled={visible >= filtered.length}
          onIonInfinite={(e) => { setVisible((v) => v + PAGE_SIZE); void e.target.complete(); }}
        >
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
