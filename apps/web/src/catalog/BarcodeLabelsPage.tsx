import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { Page, Variant } from '../api/types';
import BarcodeLabel from './BarcodeLabel';
import { encodeCode128B } from './code128';

export default function BarcodeLabelsPage() {
  const { shopId } = useParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Variant> | null>(null);
  const [selected, setSelected] = useState<Record<string, Variant>>({});
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    let active = true;
    setLoading(true);
    setError('');
    api<Page<Variant>>(
      `/shops/${shopId}/variants?q=${encodeURIComponent(search)}&page=${page}&pageSize=100`,
    )
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause) => {
        if (active) setError(errorText(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [shopId, search, page]);

  const products = Object.values(selected);
  const canPrint =
    products.length > 0 &&
    products.every((product) => {
      try {
        encodeCode128B(product.barcode);
        return true;
      } catch {
        return false;
      }
    });
  const allSelected =
    Boolean(data?.items.length) &&
    data!.items.every((item) => selected[item.id]);

  function toggle(product: Variant) {
    setSelected((current) => {
      const next = { ...current };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = product;
      return next;
    });
  }

  function togglePage() {
    if (!data) return;
    setSelected((current) => {
      const next = { ...current };
      const remove = data.items.every((item) => next[item.id]);
      for (const item of data.items) {
        if (remove) delete next[item.id];
        else next[item.id] = item;
      }
      return next;
    });
  }

  return (
    <>
      <Link className="back-link no-print" to={`/seller/${shopId}/products`}>
        ← Товары
      </Link>
      <div className="page-heading no-print">
        <div>
          <p className="eyebrow">Каталог магазина</p>
          <h1>Печать этикеток</h1>
          <p className="muted">
            Выберите товары и число наклеек. Размер этикетки — 58 × 40 мм.
          </p>
        </div>
        <button
          className="primary"
          disabled={!canPrint}
          onClick={() => window.print()}
        >
          Печать выбранных{products.length ? ` (${products.length})` : ''}
        </button>
      </div>

      <section className="panel no-print">
        <div className="toolbar">
          <label className="search-label">
            Поиск товара
            <input
              value={search}
              placeholder="Название или штрихкод"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <span className="muted">{data?.total ?? 0} товаров</span>
        </div>
        <label className="checkbox checkbox-label">
          <input type="checkbox" checked={allSelected} onChange={togglePage} />
          Выбрать все на странице
        </label>
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
                <th>Выбрать</th>
                <th>Товар</th>
                <th>Артикул</th>
                <th>Штрихкод</th>
                <th>Цена</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((product) => (
                <tr key={product.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Выбрать ${product.name}`}
                      checked={Boolean(selected[product.id])}
                      onChange={() => toggle(product)}
                    />
                  </td>
                  <td>{product.name}</td>
                  <td>{product.sku || '—'}</td>
                  <td className="code">{product.barcode}</td>
                  <td>
                    {new Intl.NumberFormat('ru-KG', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(product.salePriceMinor / 100)}{' '}
                    сом
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && !data?.items.length && (
          <p className="empty-state">Товары не найдены.</p>
        )}
        <div className="pagination">
          <button
            disabled={page === 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </button>
          <span>Страница {page}</span>
          <button
            disabled={!data || page * data.pageSize >= data.total || loading}
            onClick={() => setPage(page + 1)}
          >
            Далее
          </button>
        </div>
      </section>

      {products.length > 0 && (
        <section className="selected-labels" aria-label="Этикетки к печати">
          {products.map((product) => (
            <div className="selected-label" key={product.id}>
              <BarcodeLabel
                product={product}
                copies={copies[product.id] ?? 1}
                hidePrintButton
              />
              <label className="no-print">
                Наклеек для «{product.name}»
                <input
                  aria-label={`Количество наклеек для ${product.name}`}
                  type="number"
                  min={1}
                  max={100}
                  value={copies[product.id] ?? 1}
                  onChange={(event) =>
                    setCopies((current) => ({
                      ...current,
                      [product.id]: Math.max(
                        1,
                        Math.min(100, Number(event.target.value) || 1),
                      ),
                    }))
                  }
                />
              </label>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
