import Pagination from '../components/Pagination';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { Page, Variant } from '../api/types';
import { formatSom } from '../api/money';
import { formatDate } from '../api/money';
import { useSession } from '../auth/SessionProvider';
import BarcodeLabel from './BarcodeLabel';
import ProductThumb from './ProductThumb';
import CameraScanner from '../scanner/CameraScanner';

type StockFilter = 'all' | 'in_stock' | 'low' | 'out';
type VisibilityFilter = 'all' | 'published' | 'hidden' | 'no_photo';

export default function CatalogPage() {
  const { shopId } = useParams(),
    session = useSession(),
    [searchParams, setSearchParams] = useSearchParams(),
    [q, setQ] = useState(() => searchParams.get('q') ?? ''),
    [page, setPage] = useState(() => {
      const p = Number(searchParams.get('page'));
      return Number.isFinite(p) && p >= 1 ? p : 1;
    }),
    [archived, setArchived] = useState(
      () => searchParams.get('archived') === 'true',
    ),
    [sort, setSort] = useState(() => searchParams.get('sort') || 'newest'),
    [stockFilter, setStockFilter] = useState<StockFilter>(() => {
      const raw = searchParams.get('stock');
      return raw === 'in_stock' || raw === 'low' || raw === 'out' ? raw : 'all';
    }),
    [category, setCategory] = useState(
      () => searchParams.get('category') ?? '',
    ),
    [visibility, setVisibility] = useState<VisibilityFilter>(() => {
      const raw = searchParams.get('visibility');
      return raw === 'published' || raw === 'hidden' || raw === 'no_photo'
        ? raw
        : 'all';
    }),
    [categories, setCategories] = useState<{ name: string; count: number }[]>(
      [],
    ),
    [data, setData] = useState<Page<Variant> | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [barcodeProduct, setBarcodeProduct] = useState<Variant | null>(null),
    [scannerFocused, setScannerFocused] = useState(true),
    [cameraScannerOpen, setCameraScannerOpen] = useState(false),
    searchInputRef = useRef<HTMLInputElement>(null);
  const role = session.user?.shops.find((x) => x.id === shopId)?.role;

  const searchParamsString = searchParams.toString();
  const searchParamsRef = useRef(searchParamsString);
  searchParamsRef.current = searchParamsString;
  const setSearchParamsRef = useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;

  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (archived) next.set('archived', 'true');
    if (stockFilter !== 'all') next.set('stock', stockFilter);
    if (category) next.set('category', category);
    if (visibility !== 'all') next.set('visibility', visibility);
    if (sort !== 'newest') next.set('sort', sort);
    if (page > 1) next.set('page', String(page));
    const nextStr = next.toString();
    if (nextStr !== searchParamsRef.current) {
      setSearchParamsRef.current(next, { replace: true });
    }
  }, [q, archived, stockFilter, category, visibility, sort, page]);

  useEffect(() => {
    searchInputRef.current?.focus({ preventScroll: true });

    const keepFocus = () => {
      if (barcodeProduct || cameraScannerOpen) return;
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }
      requestAnimationFrame(() => {
        const currentActive = document.activeElement;
        if (
          currentActive &&
          (currentActive.tagName === 'INPUT' ||
            currentActive.tagName === 'TEXTAREA' ||
            currentActive.tagName === 'SELECT' ||
            currentActive.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }
        searchInputRef.current?.focus({ preventScroll: true });
        setScannerFocused(true);
      });
    };

    const handleGlobalClick = (event: MouseEvent) => {
      if (barcodeProduct || cameraScannerOpen) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest(
          'input, textarea, select, button, a, [role="button"], [role="dialog"], [role="tab"], .pagination, .barcode-dialog',
        )
      ) {
        return;
      }
      keepFocus();
    };

    const handleWindowFocus = (event: FocusEvent) => {
      if (event.target !== window && event.target !== document) return;
      keepFocus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        keepFocus();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [barcodeProduct, cameraScannerOpen]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const stockParam = stockFilter !== 'all' ? `&stock=${stockFilter}` : '';
    const categoryParam = category
      ? `&category=${encodeURIComponent(category)}`
      : '';
    const visibilityParam =
      visibility !== 'all' ? `&visibility=${visibility}` : '';
    api<Page<Variant>>(
      `/shops/${shopId}/variants?q=${encodeURIComponent(q)}&page=${page}&archived=${archived}&sort=${sort}&facets=true${stockParam}${categoryParam}${visibilityParam}`,
    )
      .then((r) => {
        if (alive) {
          setData(r);
          if (r.facets?.length) setCategories(r.facets);
        }
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [shopId, q, page, archived, stockFilter, category, visibility, sort]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Каталог магазина</p>
          <h1>Товары</h1>
          <p className="muted">Цены и доступные остатки</p>
        </div>
        {role !== 'cashier' && (
          <div className="order-actions">
            <Link className="primary button" to="new">
              Добавить товар
            </Link>
          </div>
        )}
      </div>
      <section className="panel">
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="catalog-search-wrap">
            <label className="search-label" htmlFor="catalog-search-input">
              Поиск
            </label>
            <div className="catalog-search-row">
              <div className="catalog-search-input-group">
                <svg
                  className="catalog-search-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  id="catalog-search-input"
                  ref={searchInputRef}
                  type="search"
                  autoFocus
                  autoComplete="off"
                  value={q}
                  placeholder="Название или штрихкод"
                  aria-label="Поиск"
                  onFocus={() => setScannerFocused(true)}
                  onBlur={() => setScannerFocused(false)}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setPage(1);
                    }
                  }}
                />
                {q && (
                  <button
                    type="button"
                    className="catalog-search-clear"
                    aria-label="Очистить поиск"
                    onClick={() => {
                      setQ('');
                      setPage(1);
                      searchInputRef.current?.focus();
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                type="button"
                className={`catalog-scanner-btn${scannerFocused ? ' is-active' : ''}`}
                title="USB- или Bluetooth-сканер держит фокус ввода"
                aria-label="Фокус для сканера"
                onMouseDown={(e) => {
                  e.preventDefault();
                  searchInputRef.current?.focus({ preventScroll: true });
                }}
                onClick={() => {
                  searchInputRef.current?.focus({ preventScroll: true });
                  setScannerFocused(true);
                }}
              >
                <svg
                  className="catalog-scanner-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M4 5v14M7 5v14M11 5v14M14 5v14M17 5v14M20 5v14" />
                </svg>
                <span className="catalog-scanner-text">Сканер</span>
                <span
                  className={`pos-focus-dot${scannerFocused ? ' on' : ''}`}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="catalog-scanner-camera-btn"
                title="Сканировать камерой телефона"
                aria-label="Сканировать камерой"
                onClick={() => setCameraScannerOpen(true)}
              >
                <svg
                  className="catalog-scanner-camera-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  width="22"
                  height="22"
                >
                  <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </button>
            </div>
          </div>
          <div
            className="filter-group"
            role="tablist"
            aria-label="Статус товаров"
            style={{ display: 'inline-flex', gap: '0.5rem' }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={!archived}
              className={`button ${!archived ? 'primary' : 'secondary'}`}
              onClick={() => {
                setArchived(false);
                setPage(1);
              }}
            >
              Активные
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={archived}
              className={`button ${archived ? 'primary' : 'secondary'}`}
              onClick={() => {
                setArchived(true);
                setPage(1);
              }}
            >
              В архиве
            </button>
          </div>
          <label>
            Наличие
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value as StockFilter);
                setPage(1);
              }}
            >
              <option value="all">Все остатки</option>
              <option value="in_stock">В наличии (&gt; 0)</option>
              <option value="low">Мало на складе (1–5 шт.)</option>
              <option value="out">Нет в наличии (0 шт.)</option>
            </select>
          </label>
          <label>
            Категория
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все категории</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </label>
          <label>
            Витрина и фото
            <select
              value={visibility}
              onChange={(e) => {
                setVisibility(e.target.value as VisibilityFilter);
                setPage(1);
              }}
            >
              <option value="all">Все карточки</option>
              <option value="published">На витрине</option>
              <option value="hidden">Скрытые</option>
              <option value="no_photo">Без фото</option>
            </select>
          </label>
          <label>
            Сортировка
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
              <option value="name">Название А–Я</option>
              <option value="name-desc">Название Я–А</option>
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дороже</option>
              <option value="popular">Часто продаются</option>
            </select>
          </label>
          {(q.trim() ||
            archived ||
            stockFilter !== 'all' ||
            category ||
            visibility !== 'all' ||
            sort !== 'newest') && (
            <button
              type="button"
              className="button secondary"
              style={{ alignSelf: 'flex-end' }}
              onClick={() => {
                setQ('');
                setArchived(false);
                setStockFilter('all');
                setCategory('');
                setVisibility('all');
                setSort('newest');
                setPage(1);
              }}
            >
              Сбросить
            </button>
          )}
          <span
            className="muted"
            style={{ marginLeft: 'auto', alignSelf: 'center' }}
          >
            {data?.total ?? 0} товаров
          </span>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {loading && <p aria-live="polite">Загрузка…</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th>Добавлен</th>
                {role !== 'cashier' && <th>Закупочная</th>}
                <th>Цена</th>
                <th>Доступно</th>
                <th>Резерв</th>
                <th className="no-print">Этикетка</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="catalog-product-cell">
                      <ProductThumb photoUrl={v.photoUrl} name={v.name} />
                      <div className="catalog-product-info">
                        <div className="catalog-product-title">
                          {role !== 'cashier' ? (
                            <Link to={v.id + '/edit'}>
                              <strong>{v.name}</strong>
                            </Link>
                          ) : (
                            <strong>{v.name}</strong>
                          )}
                          {(v.size || v.color) && (
                            <span className="muted">
                              {' '}
                              ({[v.size, v.color].filter(Boolean).join(', ')})
                            </span>
                          )}
                          {v.archived && (
                            <span
                              className="status-pill status-archived"
                              style={{ marginLeft: '0.5rem' }}
                            >
                              В архиве
                            </span>
                          )}
                        </div>
                        <small className="code">{v.barcode}</small>
                      </div>
                    </div>
                  </td>
                  <td>{v.createdAt ? formatDate(v.createdAt) : '—'}</td>
                  {role !== 'cashier' && (
                    <td>
                      {v.lastPurchaseMinor !== undefined
                        ? formatSom(v.lastPurchaseMinor)
                        : '—'}
                    </td>
                  )}
                  <td>{formatSom(v.salePriceMinor)}</td>
                  <td>
                    <span
                      className={
                        'stock ' +
                        (v.available
                          ? v.available <= 5
                            ? 'low'
                            : ''
                          : 'empty')
                      }
                    >
                      {v.available} шт.
                    </span>
                  </td>
                  <td>{v.reserved} шт.</td>
                  <td className="no-print">
                    <button type="button" onClick={() => setBarcodeProduct(v)}>
                      Штрихкод
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && !data?.items.length && (
          <p className="empty-state">
            {archived
              ? 'В архиве нет товаров.'
              : 'Товаров пока нет. Добавьте первую позицию.'}
          </p>
        )}
        {data && (
          <Pagination
            page={page}
            total={data.total}
            size={data.pageSize}
            busy={loading}
            onPage={setPage}
          />
        )}
      </section>
      {barcodeProduct && (
        <div
          className="barcode-dialog-backdrop"
          role="presentation"
          onClick={() => setBarcodeProduct(null)}
        >
          <section
            className="barcode-dialog panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Этикетка: ${barcodeProduct.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="barcode-dialog-heading">
              <h2>Этикетка товара</h2>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setBarcodeProduct(null)}
              >
                ×
              </button>
            </div>
            <BarcodeLabel product={barcodeProduct} />
          </section>
        </div>
      )}
      {cameraScannerOpen && (
        <div
          className="barcode-dialog-backdrop camera-scanner-backdrop"
          role="presentation"
          onClick={() => {
            setCameraScannerOpen(false);
            searchInputRef.current?.focus();
          }}
        >
          <div
            className="camera-scanner-modal panel"
            role="dialog"
            aria-modal="true"
            aria-label="Сканирование камерой"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="camera-scanner-modal__head">
              <h3>Сканировать камерой</h3>
              <button
                type="button"
                className="camera-scanner-modal__close"
                aria-label="Закрыть"
                onClick={() => {
                  setCameraScannerOpen(false);
                  searchInputRef.current?.focus();
                }}
              >
                ×
              </button>
            </div>
            <CameraScanner
              onScan={(code) => {
                setQ(code);
                setPage(1);
                setCameraScannerOpen(false);
                searchInputRef.current?.focus();
              }}
              onClose={() => {
                setCameraScannerOpen(false);
                searchInputRef.current?.focus();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
