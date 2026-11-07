import { useState } from 'react';
import BuyerInviteQr from './BuyerInviteQr';
import { buyerInviteLink } from './buyerInviteLink';

type Props = {
  name: string;
  token: string;
  expiresAt: string;
  onClose: () => void;
};

export default function BuyerActivationPanel({
  name,
  token,
  expiresAt,
  onClose,
}: Props) {
  const [feedback, setFeedback] = useState('');
  const link = buyerInviteLink(token, window.location.origin);
  const message = `Войдите в кабинет покупателя MyStore и примите приглашение: ${link}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setFeedback('Ссылка скопирована');
    } catch {
      setFeedback('Не удалось скопировать автоматически — выделите ссылку ниже.');
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Приглашение в MyStore',
          text: 'Приглашение в кабинет покупателя MyStore',
          url: link,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setFeedback('Поделиться не удалось. Скопируйте ссылку.');
        }
      }
    } else {
      await copyLink();
    }
  }

  return (
    <section className="buyer-message buyer-invite-panel credit-invite-card" role="status">
      <h3>Приглашение для {name}</h3>
      <p>
        Покажите QR или отправьте ссылку. Покупатель войдёт в общий кабинет
        MyStore, затем подтвердит доступ к данным этого магазина.
      </p>
      <div className="credit-invite-content">
        <BuyerInviteQr value={link} />
        <div className="credit-invite-link" aria-label="Ссылка приглашения">
          {link}
        </div>
        <div className="credit-invite-actions">
          <button type="button" onClick={() => void copyLink()}>
            Копировать
          </button>
          <button type="button" onClick={() => void shareLink()}>
            Поделиться
          </button>
          <button
            type="button"
            onClick={() => {
              window.open(link, '_blank', 'noopener,noreferrer');
            }}
          >
            Открыть
          </button>
        </div>
      </div>
      <small>
        Ссылка одноразовая и действует до{' '}
        {new Date(expiresAt).toLocaleTimeString('ru-KG', {
          hour: '2-digit',
          minute: '2-digit',
        })}
        . После этого можно выдать новую.
      </small>
      <p className="muted">
        Долг станет доступен после подтверждения приглашения и одобрения
        кредита владельцем магазина.
      </p>
      {feedback && <p role="status">{feedback}</p>}
      <button type="button" onClick={onClose}>
        Готово
      </button>
    </section>
  );
}
