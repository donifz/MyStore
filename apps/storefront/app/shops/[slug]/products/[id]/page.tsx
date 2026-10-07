import BuyButton from '../../../../../components/BuyButton';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  publicApi,
  PublicApiError,
  Product,
  formatSom,
} from '../../../../../lib/public-api';
import { metadata, productJson } from '../../../../../lib/seo';
import Refresh from '../../../../../components/Refresh';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string; id: string }> };
async function load(params: Props['params']) {
  const { slug, id } = await params;
  return publicApi<Product>(
    '/stores/' +
      encodeURIComponent(slug) +
      '/products/' +
      encodeURIComponent(id),
  );
}
export async function generateMetadata({ params }: Props) {
  try {
    const p = await load(params);
    return metadata(
      p.name + ' — ' + p.store.name + ' | MyStore',
      p.description ||
        `${p.name}: цена ${formatSom(p.salePriceMinor)}, магазин ${p.store.name}, ${p.store.city}.`,
      `/shops/${p.store.slug}/products/${p.id}`,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    return metadata(
      'Товар временно недоступен — MyStore',
      'Попробуйте позднее.',
      '/',
      true,
    );
  }
}
export default async function ProductPage({ params }: Props) {
  let v: Product;
  try {
    v = await load(params);
  } catch (e) {
    if (e instanceof PublicApiError && (e.status === 404 || e.status === 400))
      notFound();
    return (
      <section role="alert" className="market-empty">
        <h1>Не удалось загрузить товар</h1>
        <p>Попробуйте позднее.</p>
      </section>
    );
  }
  return (
    <>
      <Refresh />
      <script
        type="application/ld+json"
        nonce={(await headers()).get('x-nonce') || undefined}
        dangerouslySetInnerHTML={{ __html: productJson(v) }}
      />
      <Link className="back-link" href={'/shops/' + v.store.slug}>
        ← {v.store.name}
      </Link>
      <article className="product-detail">
        <div className="product-cover detail-cover" aria-hidden="true">
          <>
            {v.photoUrl ? (
              <img src={v.photoUrl} alt="" />
            ) : (
              <span>{v.name.slice(0, 1)}</span>
            )}
          </>
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
          <BuyButton product={v} />
          <div className="contact-card">
            <Link href={'/shops/' + v.store.slug}>
              <h2>{v.store.name}</h2>
            </Link>
            <p>
              {v.store.city}
              {v.store.address ? ' · ' + v.store.address : ''}
            </p>
            {v.store.hours && <p>{v.store.hours}</p>}
            <a
              className="primary button full-width"
              href={'tel:' + v.store.phone?.replace(/[^\d+]/g, '')}
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
