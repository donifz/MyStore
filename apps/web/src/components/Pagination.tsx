type PageItem = number | '…';

export function paginationItems(page: number, totalPages: number): PageItem[] {
  const last = Math.max(1, Math.floor(totalPages) || 1);
  const current = Math.max(1, Math.min(last, Math.floor(page) || 1));
  if (last <= 5) return Array.from({ length: last }, (_, index) => index + 1);

  const start = Math.max(1, Math.min(current - 2, last - 4));
  const pages = Array.from({ length: 5 }, (_, index) => start + index);
  const result: PageItem[] = [];

  if (start > 1) {
    result.push(1);
    if (start > 2) result.push('…');
  }
  result.push(...pages);
  if (start + 4 < last) {
    if (start + 4 < last - 1) result.push('…');
    result.push(last);
  }
  return result;
}

export default function Pagination({
  page,
  total,
  size,
  busy = false,
  onPage,
  label = 'Страницы списка',
}: {
  page: number;
  total: number;
  size: number;
  busy?: boolean;
  onPage: (page: number) => void;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, size)));
  const current = Math.max(1, Math.min(page, pages));
  const requestedPage = Math.max(1, Math.floor(page) || 1);

  return (
    <nav className="pagination" aria-label={label}>
      <button
        type="button"
        disabled={busy || requestedPage === 1}
        onClick={() => onPage(Math.max(1, requestedPage - 1))}
      >
        Назад
      </button>
      <div className="pagination-pages">
        {paginationItems(current, pages).map((value, index) =>
          value === '…' ? (
            <span
              className="pagination-ellipsis"
              aria-hidden="true"
              key={`gap-${index}`}
            >
              …
            </span>
          ) : (
            <button
              type="button"
              key={value}
              aria-label={`Страница ${value}`}
              aria-current={current === value ? 'page' : undefined}
              className={current === value ? 'pagination-current' : undefined}
              disabled={busy || current === value}
              onClick={() => onPage(value)}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        disabled={busy || current === pages}
        onClick={() => onPage(current + 1)}
      >
        Далее
      </button>
      {pages > 5 && (
        <button
          type="button"
          disabled={busy || current === pages}
          onClick={() => onPage(pages)}
        >
          В конец
        </button>
      )}
    </nav>
  );
}
