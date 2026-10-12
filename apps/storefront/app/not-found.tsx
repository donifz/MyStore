import { EmptyState, LinkButton } from '../components/ui';
export default function NotFound() {
  return (
    <EmptyState
      title="Страница недоступна"
      description="Магазин или товар скрыт либо не найден."
      action={<LinkButton href="/">Вернуться в каталог</LinkButton>}
    />
  );
}
