import { LinkButton } from './ui';
export default function Pagination({
  path,
  params,
  page,
  total,
}: {
  path: string;
  params: URLSearchParams;
  page: number;
  total: number;
}) {
  if (total <= 24 && page <= 1) return null;
  const href = (n: number) => {
    const p = new URLSearchParams(params);
    p.delete('store');
    p.set('page', String(n));
    return path + '?' + p;
  };
  return (
    <nav className="sf-pagination" aria-label="Страницы каталога">
      {page > 1 ? (
        <LinkButton
          variant="secondary"
          aria-label="Предыдущая страница"
          href={href(page - 1)}
        >
          ← Назад
        </LinkButton>
      ) : (
        <span className="sf-muted">Назад</span>
      )}
      <span>Страница {page}</span>
      {page * 24 < total ? (
        <LinkButton
          variant="secondary"
          aria-label="Следующая страница"
          href={href(page + 1)}
        >
          Далее →
        </LinkButton>
      ) : (
        <span className="sf-muted">Далее</span>
      )}
    </nav>
  );
}
