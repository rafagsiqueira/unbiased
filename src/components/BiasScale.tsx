import { useTranslation } from 'react-i18next';
import type { BiasScore } from '../../shared/types';
import './BiasScale.css';

interface Props {
  bias: BiasScore | null | undefined;
  /** true while a scoring request is in flight */
  pending: boolean;
}

export default function BiasScale({ bias, pending }: Props) {
  const { t } = useTranslation();
  const position = bias ? (bias.value + 100) / 2 : 50;
  const sign = bias && bias.value > 0 ? '+' : '';

  return (
    <div
      className="bias"
      role="img"
      aria-label={bias ? t('bias.label', { value: `${sign}${bias.value}` }) : pending ? t('bias.pending') : t('bias.unavailable')}
    >
      <div className={`bias__track${bias ? '' : ' bias__track--empty'}`}>
        <span className="bias__center" />
        {bias && <span className="bias__marker" style={{ left: `${position}%` }} />}
      </div>
      <div className="bias__legend">
        <span>{t('bias.left')}</span>
        <span className="bias__status">
          {bias ? `${sign}${bias.value} · ${t('bias.confidence', { percent: Math.round(bias.confidence * 100) })}` : pending ? t('bias.pending') : t('bias.unavailable')}
        </span>
        <span>{t('bias.right')}</span>
      </div>
    </div>
  );
}
