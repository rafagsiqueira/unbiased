import {
  IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonListHeader,
  IonModal, IonSelect, IonSelectOption, IonTitle, IonToggle, IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { FeedsResponse } from '../../shared/types';
import type { Prefs } from '../lib/prefs';

interface Props {
  open: boolean;
  catalog: FeedsResponse | null;
  prefs: Prefs;
  onChange: (prefs: Prefs) => void;
  onClose: () => void;
}

export default function SettingsModal({ open, catalog, prefs, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const market = `${prefs.country}:${prefs.language}`;
  const feeds = catalog?.feeds.filter((f) => f.country === prefs.country && f.language === prefs.language) ?? [];

  return (
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('settings.title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>{t('settings.close')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonItem>
            <IonSelect
              label={t('settings.market')}
              value={market}
              onIonChange={(e) => {
                const [country, language] = String(e.detail.value).split(':');
                onChange({ ...prefs, country, language, hiddenFeeds: [] });
              }}
            >
              {(catalog?.countries ?? []).map((c) => (
                <IonSelectOption key={`${c.country}:${c.language}`} value={`${c.country}:${c.language}`}>
                  {t(`countries.${c.country}`, c.country)} · {t(`languages.${c.language}`, c.language)}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonListHeader>
            <IonLabel>{t('settings.outlets')}</IonLabel>
          </IonListHeader>
          {feeds.map((f) => (
            <IonItem key={f.id}>
              <IonToggle
                checked={!prefs.hiddenFeeds.includes(f.id)}
                onIonChange={(e) =>
                  onChange({
                    ...prefs,
                    hiddenFeeds: e.detail.checked
                      ? prefs.hiddenFeeds.filter((id) => id !== f.id)
                      : [...prefs.hiddenFeeds, f.id],
                  })
                }
              >
                {f.outlet} · {t(`categories.${f.category}`)}
              </IonToggle>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonModal>
  );
}
