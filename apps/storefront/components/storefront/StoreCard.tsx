import Link from 'next/link';
import type { Store } from '../../lib/public-api';
import Icon from './Icon';
export default function StoreCard({ store: s }: { store: Store }) {
  return (
    <article className="sf-store-card">
      <div className="sf-shop-cover">
        <Icon name="shop" width={90} height={90} />
        <span>{s.categories?.[0] || 'Магазины рядом'}</span>
      </div>
      <div className="sf-shop-body">
        <span className="sf-store-monogram">
          {s.name.slice(0, 1).toUpperCase()}
        </span>
        <h2>
          <Link href={'/shop/' + s.slug}>{s.name}</Link>
        </h2>
        <p className="sf-shop-meta">
          <Icon name="pin" />
          {[s.city, s.district || s.address].filter(Boolean).join(', ') ||
            'Адрес уточняется'}
        </p>
        <p className="sf-shop-meta">
          <Icon name="box" />
          {s.productCount ?? 0} товаров в каталоге
        </p>
        <div className="sf-tags">
          {s.categories?.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <p className="sf-shop-description">
          {s.description || 'Находите нужное в каталоге этого магазина.'}
        </p>
        <Link
          className="sf-button sf-button--secondary"
          href={'/shop/' + s.slug}
        >
          Перейти в магазин <Icon name="arrow" />
        </Link>
      </div>
    </article>
  );
}
