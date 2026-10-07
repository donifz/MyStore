import { Link, useParams } from 'react-router-dom';
import { formatSom } from '../api/money';
import { PublicProduct } from './types';
import { useResource } from './use-resource';
export default function ProductPage() {
  const { slug, id } = useParams();
  const r = useResource<PublicProduct>(
    `/public/stores/${encodeURIComponent(slug ?? '')}/products/${encodeURIComponent(id ?? '')}`,
    true,
  );
  if (r.status === 404)
    return (
      <div className="market-empty">
        <h1>Товар недоступен или снят с публикации.</h1>
        <Link to="/">Вернуться в каталог</Link>
      </div>
    );
  if (!r.data)
    return (
      <p
        className={r.error ? 'error' : 'loading'}
        role={r.error ? 'alert' : 'status'}
      >
        {r.error || 'Загрузка товара…'}
      </p>
    );
  const v = r.data;
  return (
    <>
      <Link className="back-link" to={'/shops/' + v.store.slug}>
        ← {v.store.name}
      </Link>
      {r.error && (
        <p role="alert" className="error">
          Не удалось обновить наличие. {r.error}
        </p>
      )}
      <article className="product-detail">
        <div className="product-cover detail-cover" aria-hidden="true">
          <span>{v.name.slice(0, 1)}</span>
          <small>{v.category || 'Товар магазина'}</small>
        </div>
        <div>
          <p className="eyebrow">{v.category || v.store.city}</p>
          <h1>{v.name}</h1>
          <p className="detail-price">{formatSom(v.salePriceMinor)}</p>
          <p className={'stock ' + (!v.available ? 'empty' : '')}>
            {v.available ? `В наличии: ${v.available} шт.` : 'Нет в наличии'}
          </p>
          {v.description && (
            <p className="product-description">{v.description}</p>
          )}
          <div className="contact-card">
            <Link to={'/shops/' + v.store.slug}>
              <h2>{v.store.name}</h2>
            </Link>
            <p>
              {v.store.city}
              {v.store.address ? ' · ' + v.store.address : ''}
            </p>
            {v.store.hours && <p>{v.store.hours}</p>}
            <a
              className="primary button full-width"
              href={'tel:' + (v.store.phone ?? '').replace(/[^\d+]/g, '')}
            >
              Связаться с магазином
            </a>
            <p className="muted">
              Покупку, самовывоз и доставку согласуйте с продавцом. Наличие
              может измениться до покупки.
            </p>
          </div>
        </div>
      </article>
    </>
  );
}
