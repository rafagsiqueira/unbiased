import { IonCard, IonCardContent, IonChip, IonLabel } from '@ionic/react';
import { Browser } from '@capacitor/browser';
import { useTranslation } from 'react-i18next';
import type { StoredArticle } from '../../shared/types';
import { timeAgo } from '../lib/format';
import BiasScale from './BiasScale';

interface Props {
  article: StoredArticle;
}

export default function ArticleCard({ article }: Props) {
  const { t } = useTranslation();
  return (
    <IonCard>
      <IonCardContent>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <strong>{article.outlet}</strong>
          <IonChip outline style={{ margin: 0 }}>
            <IonLabel>{t(`categories.${article.category}`)}</IonLabel>
          </IonChip>
          <time dateTime={article.publishedAt} style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>
            {timeAgo(article.publishedAt)}
          </time>
        </div>
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          aria-label={`${t('timeline.open')}: ${article.title}`}
          style={{ color: 'inherit', textDecoration: 'none' }}
          onClick={(e) => {
            e.preventDefault();
            void Browser.open({ url: article.link });
          }}
        >
          <h2 style={{ fontSize: '1.05rem', lineHeight: 1.3, margin: '0 0 6px' }}>{article.title}</h2>
          {article.summary && <p style={{ margin: 0, fontSize: '0.9rem' }}>{article.summary}</p>}
        </a>
        <BiasScale bias={article.bias} />
      </IonCardContent>
    </IonCard>
  );
}
