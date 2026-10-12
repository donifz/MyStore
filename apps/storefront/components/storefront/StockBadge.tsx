import Badge from '../ui/Badge';
export default function StockBadge({
  available,
  detailed = false,
}: {
  available: number;
  detailed?: boolean;
}) {
  return (
    <Badge variant={available > 0 ? 'success' : 'neutral'}>
      {available > 0
        ? detailed
          ? `В наличии: ${available} шт.`
          : 'В наличии'
        : 'Нет в наличии'}
    </Badge>
  );
}
