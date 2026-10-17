export default function OrderDeadline({
  expiresAt,
  timeZone = 'Asia/Bishkek',
}: {
  expiresAt?: string | null;
  timeZone?: string;
}) {
  if (!expiresAt) return null;
  return (
    <small className="order-deadline">
      Подтвердить до{' '}
      <time dateTime={expiresAt}>
        {new Intl.DateTimeFormat('ru-RU', {
          timeZone,
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(expiresAt))}
      </time>{' '}
      <span className="muted">({timeZone})</span>
    </small>
  );
}
