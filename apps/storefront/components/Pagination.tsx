import Link from 'next/link';
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
    <nav className="pagination" aria-label="Страницы каталога">
      {page > 1 ? (
        <Link
          className="button"
          aria-label="Предыдущая страница"
          href={href(page - 1)}
        >
          Назад
        </Link>
      ) : (
        <span>Назад</span>
      )}
      <span>Страница {page}</span>
      {page * 24 < total ? (
        <Link
          className="button"
          aria-label="Следующая страница"
          href={href(page + 1)}
        >
          Далее
        </Link>
      ) : (
        <span>Далее</span>
      )}
    </nav>
  );
}
