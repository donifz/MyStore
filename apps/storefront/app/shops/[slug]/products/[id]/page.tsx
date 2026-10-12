import { Alert } from '../../../../../components/ui';
import Price from '../../../../../components/storefront/Price';
import StockBadge from '../../../../../components/storefront/StockBadge';
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
      <Alert variant="error">
        <h1>Не удалось загрузить товар</h1>
        <p>Попробуйте позднее.</p>
      </Alert>
    );
  }
  const phone = v.store.phone?.replace(/[^\d+]/g, '');
  return (
    <div className="sf-stack">
      <Refresh />
      <script
        type="application/ld+json"
        nonce={(await headers()).get('x-nonce') || undefined}
        dangerouslySetInnerHTML={{ __html: productJson(v) }}
      />
      <Link className="sf-back" href={'/shops/' + v.store.slug}>
        ← {v.store.name}
      </Link>
      <article className="sf-product-detail">
        <div className="sf-product-cover sf-detail-cover" aria-hidden="true">
          {v.photoUrl ? (
            <img src={v.photoUrl} alt="" />
          ) : (
            <span className="sf-product-placeholder">{v.name.slice(0, 1)}</span>
          )}
          <span className="sf-product-category">
            {v.category || 'Товар магазина'}
          </span>
        </div>
        <div className="sf-stack">
          <div>
            <p className="sf-eyebrow">{v.category || v.store.city}</p>
            <h1>{v.name}</h1>
            <Price minor={v.salePriceMinor} className="sf-detail-price" />
            <StockBadge available={v.available} detailed />
          </div>
          {v.description && (
            <p className="sf-product-description">{v.description}</p>
          )}
          <BuyButton product={v} />
          <section className="sf-panel sf-contact">
            <p className="sf-eyebrow">Ваш продавец</p>
            <Link href={'/shops/' + v.store.slug}>
              <h2>{v.store.name}</h2>
            </Link>
            <p>
              {v.store.city}
              {v.store.address ? ' · ' + v.store.address : ''}
            </p>
            {v.store.hours && <p>{v.store.hours}</p>}
            {phone && (
              <a
                className="sf-button sf-button--primary sf-full"
                href={'tel:' + phone}
              >
                Связаться с магазином
              </a>
            )}
            <p className="sf-muted">
              Покупку, самовывоз и доставку согласуйте с продавцом. Наличие
              может измениться до покупки.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
