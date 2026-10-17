import Link from 'next/link';
import type { Product } from '../../lib/public-api';
import Icon from './Icon';
export default function MarketplaceHero({
  products = [],
  shops = false,
}: {
  products?: Product[];
  shops?: boolean;
}) {
  const photos = products.filter((p) => p.photoUrl).slice(0, 3);
  return (
    <div className="sf-hero-layout">
      <section className="sf-market-hero">
        <div className="sf-market-hero-copy">
          <p className="sf-eyebrow">
            {shops
              ? 'Локальный бизнес. Большой выбор.'
              : 'Покупайте у местных магазинов'}
          </p>
          <h1>
            {shops ? (
              <>
                Магазины рядом.
                <br />
                <em>Находки для вас.</em>
              </>
            ) : (
              <>
                Товары рядом
                <br />
                <em>от разных магазинов</em>
              </>
            )}
          </h1>
          <p>
            {shops
              ? 'Знакомьтесь с продавцами вашего города, смотрите ассортимент и выбирайте удобный способ получения.'
              : 'Всё, что нужно, — в одном месте. Выбирайте, сравнивайте цены и заказывайте у магазинов рядом.'}
          </p>
          <Link
            className="sf-button sf-button--primary"
            href={shops ? '#shops' : '#catalog'}
          >
            {shops ? 'Выбрать магазин' : 'Перейти к товарам'}
            <Icon name="arrow" />
          </Link>
        </div>
        <div className="sf-market-art" aria-hidden="true">
          <div className="sf-art-orbit" />
          <div className="sf-shopping-bag">
            <span>m.</span>
            <strong>MyStore</strong>
            <small>Хорошие находки рядом</small>
          </div>
          {!photos.length ? (
            <div className="sf-art-showcase">
              <div className="sf-art-chip sf-art-chip--1">
                <span className="sf-art-chip-icon">
                  <Icon name="shop" width={16} height={16} />
                </span>
                <span>Магазины города</span>
              </div>
              <div className="sf-art-chip sf-art-chip--2">
                <span className="sf-art-chip-icon">
                  <Icon name="shield" width={16} height={16} />
                </span>
                <span>Честные остатки</span>
              </div>
              <div className="sf-art-chip sf-art-chip--3">
                <span className="sf-art-chip-icon">
                  <Icon name="box" width={16} height={16} />
                </span>
                <span>Быстрый самовывоз</span>
              </div>
            </div>
          ) : (
            photos.map((p, i) => (
              <div className={'sf-art-product sf-art-product--' + i} key={p.id}>
                <img src={p.photoUrl} alt="" />
              </div>
            ))
          )}
          <span className="sf-art-note">
            <Icon name="pin" /> Ваши местные магазины
          </span>
        </div>
      </section>
    </div>
  );
}
