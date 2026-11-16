import { useState } from 'react';
import BuyerInviteQr from '../customers/BuyerInviteQr';
import { useCustomerActivationPoll } from '../customers/useCustomerActivationPoll';
import PaymentIcon from './PaymentIcon';
import {
  buyerInviteLink,
  buyerInviteSmsUrl,
  buyerInviteWhatsAppUrl,
} from '../customers/buyerInviteLink';

type Props = {
  name: string;
  phone?: string;
  token: string;
  expiresAt: string;
  shopId?: string;
  customerId?: string;
  onActivated?: () => void;
  onClose: () => void;
};

export default function PosBuyerInvitation({
  name,
  phone,
  token,
  expiresAt,
  shopId,
  customerId,
  onActivated,
  onClose,
}: Props) {
  const [feedback, setFeedback] = useState('');
  const link = buyerInviteLink(token, window.location.origin);
  const whatsAppUrl = buyerInviteWhatsAppUrl(phone, name, link);
  const smsUrl = buyerInviteSmsUrl(phone, name, link);

  useCustomerActivationPoll(shopId, customerId, onActivated);

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
        Покажите QR-код или отправьте ссылку в WhatsApp / SMS. Покупатель сразу
        окажется в своём кабинете с готовым паролем, а после перехода появится у
        вас в списке для оформления долга.
      </p>
      <div className="credit-invite-content">
        <BuyerInviteQr value={link} />
        <div className="credit-invite-link" aria-label="Ссылка приглашения">
          {link}
        </div>
        <div className="credit-invite-actions">
          {whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="credit-invite-whatsapp"
            >
              <PaymentIcon name="share" size={16} />
              WhatsApp
            </a>
          )}
          {smsUrl && (
            <a href={smsUrl} className="credit-invite-sms">
              SMS
            </a>
          )}
          <button type="button" onClick={() => void copy()}>
            <PaymentIcon name="copy" size={16} />
            Копировать
          </button>
          <button type="button" onClick={() => void share()}>
            <PaymentIcon name="share" size={16} />
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
