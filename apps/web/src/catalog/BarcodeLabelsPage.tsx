import Pagination from '../components/Pagination';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { Page, Variant } from '../api/types';
import BarcodeLabel, {
  isSmallLabelBarcodeDense,
  LabelPrintPage,
  LabelSize,
  normalizeLabelCopies,
} from './BarcodeLabel';
import { encodeCode128B } from './code128';

export default function BarcodeLabelsPage() {
  const { shopId } = useParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [data, setData] = useState<Page<Variant> | null>(null);
  const [selected, setSelected] = useState<Record<string, Variant>>({});
  const [copies, setCopies] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [labelSize, setLabelSize] = useState<LabelSize>('30x20');
  const [printingAll, setPrintingAll] = useState(false);
  const [allPrintProducts, setAllPrintProducts] = useState<Variant[] | null>(
    null,
  );

  useEffect(() => {
    if (!shopId) return;
    let active = true;
    setLoading(true);
    setError('');
    api<Page<Variant>>(
      `/shops/${shopId}/variants?q=${encodeURIComponent(search)}&page=${page}&pageSize=100&sort=${sort}`,
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
  }, [shopId, search, page, sort]);

  // Bulk printing is a temporary batch; preserve the user's manual selection.
  const products = allPrintProducts ?? Object.values(selected);

  useEffect(() => {
    if (!allPrintProducts?.length) return;

    const reset = () => setAllPrintProducts(null);
    window.addEventListener('afterprint', reset);
    // Allow React to commit every label before opening the print preview.
    const timer = window.setTimeout(() => window.print(), 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', reset);
    };
  }, [allPrintProducts]);

  async function printAllProducts() {
    if (!shopId || printingAll) return;
    setPrintingAll(true);
    setError('');
    try {
      const all: Variant[] = [];
      let currentPage = 1;
      let total = 0;

      do {
        const result = await api<Page<Variant>>(
          `/shops/${shopId}/variants?page=${currentPage}&pageSize=100`,
        );
        total = result.total;
        if (total > all.length && !result.items.length) {
          throw new Error('Не удалось загрузить все товары для печати');
        }
        all.push(...result.items);
        currentPage += 1;
      } while (all.length < total);

      if (all.length === 0) {
        setError('В каталоге нет товаров для печати');
        return;
      }
      const invalid = all.filter((product) => {
        try {
          encodeCode128B(product.shortBarcode || product.barcode);
          return false;
        } catch {
          return true;
        }
      });
      if (invalid.length) {
        setError(
          `Невозможно напечатать все товары: у ${invalid.length} товаров недопустимый штрихкод`,
        );
        return;
      }
      setAllPrintProducts(all);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPrintingAll(false);
    }
  }
  const canPrint =
    !printingAll &&
    Object.values(selected).length > 0 &&
    Object.values(selected).every((product) => {
      try {
        encodeCode128B(product.shortBarcode || product.barcode);
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
            Выберите товары для печати или распечатайте весь каталог (по одной
            наклейке на товар).
          </p>
        </div>
        <div className="barcode-print-tools">
          <label>
            Размер этикетки
            <select
              aria-label="Размер этикетки"
              value={labelSize}
              onChange={(event) =>
                setLabelSize(event.target.value as LabelSize)
              }
            >
              <option value="30x20">30 × 20 мм</option>
              <option value="58x40">58 × 40 мм</option>
            </select>
          </label>
          <button
            className="primary"
            disabled={!canPrint || Boolean(allPrintProducts)}
            onClick={() => window.print()}
          >
            Печать выбранных
            {Object.keys(selected).length
              ? ` (${Object.keys(selected).length})`
              : ''}
          </button>
          <button
            type="button"
            disabled={!shopId || printingAll || Boolean(allPrintProducts)}
            onClick={printAllProducts}
          >
            {printingAll ? 'Загрузка всех товаров…' : 'Распечатать все товары'}
          </button>
        </div>
      </div>

      <section className="panel no-print">
        <details className="hardware-guide">
          <summary>Настройка термопринтера и сканера</summary>
          <div className="hardware-guide-body">
            <p>
              <strong>Термопринтер этикеток:</strong> в окне системной печати
              выберите тот же размер бумаги, что указан выше (
              {labelSize === '30x20' ? '30 × 20 мм' : '58 × 40 мм'}), поля —{' '}
              <code>Нет (0 мм)</code>, масштаб — <code>100%</code> и отключите
              «Верхние и нижние колонтитулы».
            </p>
            <p>
              <strong>USB-сканер штрихкодов (EAN-13 / EAN-8 / Code128):</strong>{' '}
              подключите сканер в режиме клавиатуры (<code>USB HID</code>) с
              суффиксом <code>Enter</code>. Нажмите пробную наклейку и проверьте
              считывание в разделе «Продажа» или «Приёмка».
            </p>
          </div>
        </details>
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
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дороже</option>
            </select>
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
                <th>Добавлен</th>
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
                  <td>{product.createdAt ? new Date(product.createdAt).toLocaleDateString('ru-KG') : '—'}</td>
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

      {products.length > 0 && (
        <>
          <LabelPrintPage size={labelSize} />
          {labelSize === '30x20' &&
            products.some((product) =>
              isSmallLabelBarcodeDense(product.shortBarcode || product.barcode),
            ) && (
              <p className="barcode-size-warning no-print">
                Длинный штрихкод может плохо считываться на наклейке 30 × 20 мм.
                Для такого товара используйте короткий код или этикетку 58 × 40
                мм.
              </p>
            )}
          <section className="selected-labels" aria-label="Этикетки к печати">
            {products.map((product) => (
              <div className="selected-label" key={product.id}>
                <BarcodeLabel
                  product={product}
                  copies={
                    allPrintProducts
                      ? 1
                      : normalizeLabelCopies(copies[product.id] ?? '1')
                  }
                  hidePrintButton
                  size={labelSize}
                />
                {!allPrintProducts && (
                  <label className="no-print">
                    Наклеек для «{product.name}»
                    <input
                      aria-label={`Количество наклеек для ${product.name}`}
                      type="number"
                      min={1}
                      max={100}
                      value={copies[product.id] ?? '1'}
                      onChange={(event) =>
                        setCopies((current) => ({
                          ...current,
                          [product.id]: event.target.value,
                        }))
                      }
                      onBlur={() =>
                        setCopies((current) => ({
                          ...current,
                          [product.id]: String(
                            normalizeLabelCopies(current[product.id] ?? '1'),
                          ),
                        }))
                      }
                    />
                  </label>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
