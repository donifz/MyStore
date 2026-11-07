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
  const link = buyerInviteLink(token, window.location.origin);
  return (
    <div className="buyer-message buyer-invite-panel" role="status">
      <strong>Приглашение для {name}</strong>
      <p>
        Покажите QR-код покупателю. Он откроет MyStore, войдёт или
        зарегистрируется со своим номером и подтвердит привязку.
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
