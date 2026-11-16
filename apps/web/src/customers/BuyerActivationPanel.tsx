import BuyerInviteQr from './BuyerInviteQr';
import {
  buyerInviteLink,
  buyerInviteSmsUrl,
  buyerInviteWhatsAppUrl,
} from './buyerInviteLink';
import { useCustomerActivationPoll } from './useCustomerActivationPoll';

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

export default function BuyerActivationPanel({
  name,
  phone,
  token,
  expiresAt,
  shopId,
  customerId,
  onActivated,
  onClose,
}: Props) {
  const link = buyerInviteLink(token, window.location.origin);
  const whatsAppUrl = buyerInviteWhatsAppUrl(phone, name, link);
  const smsUrl = buyerInviteSmsUrl(phone, name, link);
  useCustomerActivationPoll(shopId, customerId, onActivated);
  return (
    <div className="buyer-message buyer-invite-panel" role="status">
      <strong>Приглашение для {name}</strong>
      <p>
        Покажите QR-код или отправьте ссылку в WhatsApp / SMS. Покупатель
        откроет MyStore, войдёт или зарегистрируется со своим номером и
        подтвердит привязку.
      </p>
      <BuyerInviteQr value={link} />
      <small>
        Ссылка одноразовая. Действует до{' '}
        {new Date(expiresAt).toLocaleTimeString('ru-KG', {
          hour: '2-digit',
          minute: '2-digit',
        })}
        .
      </small>
      {whatsAppUrl && (
        <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
          Отправить в WhatsApp
        </a>
      )}
      {smsUrl && <a href={smsUrl}>Отправить по SMS</a>}
      <a href={link} target="_blank" rel="noopener noreferrer">
        Открыть ссылку покупателя
      </a>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(link);
        }}
      >
        Скопировать ссылку
      </button>
      <button type="button" onClick={onClose}>
        Скрыть приглашение
      </button>
    </div>
  );
}
