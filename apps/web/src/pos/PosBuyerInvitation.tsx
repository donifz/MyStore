import { useState } from 'react';
import BuyerInviteQr from '../customers/BuyerInviteQr';
import { buyerInviteLink } from '../customers/buyerInviteLink';

type Props = {
  name: string;
  token: string;
  expiresAt: string;
  onClose: () => void;
};

export default function PosBuyerInvitation({
  name,
  token,
  expiresAt,
  onClose,
}: Props) {
  const [feedback, setFeedback] = useState('');
  const link = buyerInviteLink(token, window.location.origin);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setFeedback('Ссылка скопирована');
    } catch {
      setFeedback('Не удалось скопировать. Выделите ссылку вручную.');
    }
  }

  async function share() {
    if (!navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({
        title: 'Приглашение в MyStore',
        text: 'Войдите в кабинет покупателя MyStore',
        url: link,
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setFeedback('Не удалось поделиться. Скопируйте ссылку.');
      }
    }
  }

  return (
    <div className="credit-invite-card" role="status">
      <h3>Приглашение для {name}</h3>
      <p>
        Покажите QR или отправьте ссылку. Покупатель войдёт в общий кабинет
        MyStore и подтвердит доступ к данным магазина.
      </p>
      <div className="credit-invite-content">
        <BuyerInviteQr value={link} />
        <div className="credit-invite-link" aria-label="Ссылка приглашения">
          {link}
        </div>
        <div className="credit-invite-actions">
          <button type="button" onClick={() => void copy()}>
            Копировать
          </button>
          <button type="button" onClick={() => void share()}>
            Поделиться
          </button>
          <a href={link} target="_blank" rel="noopener noreferrer">
            Открыть
          </a>
        </div>
      </div>
      <small>
        Ссылка одноразовая, действует до{' '}
        {new Date(expiresAt).toLocaleTimeString('ru-KG', {
          hour: '2-digit',
          minute: '2-digit',
        })}
        .
      </small>
      <p>
        Долг можно оформить без подтверждения кабинета. QR нужен покупателю
        только для безопасного доступа к своему кабинету.
      </p>
      {feedback && <p role="status">{feedback}</p>}
      <button type="button" onClick={onClose}>
        Готово
      </button>
    </div>
  );
}
