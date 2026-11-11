import Link from 'next/link';
import { publicFilters } from '../../lib/public-api';
import { CartLink } from '../CartProvider';
import { MobileNav, TopNav } from './HeaderNav';
import Icon from './Icon';

export default async function Header() {
  let cities: string[] = [];
  try {
    const f = await publicFilters();
    cities = [...new Set(f.locations.map((l) => l.city))];
  } catch {
    cities = [];
  }
  return (
    <>
      <header className="sf-header">
        <div className="sf-container sf-header__inner">
          <Link href="/" className="sf-brand">
            <span className="sf-brand__mark" aria-hidden="true">
              <Icon name="bag" width={20} height={20} />
            </span>
            <span>
              <strong>MyStore</strong>
            </span>
          </Link>
          <TopNav />
          <form action="/" className="sf-global-search" role="search">
            <label className="sf-city sf-sr-only">
              <select name="city" aria-label="Выберите город">
                <option value="">Все города</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="sf-search-box">
              <Icon name="search" width={17} height={17} />
              <input
                type="search"
                name="q"
                maxLength={128}
                aria-label="Поиск товаров"
                placeholder="Найти товары, магазины, категории..."
              />
              <button
                type="submit"
                className="sf-search-kbd"
                aria-label="Найти"
              >
                ⌘K
              </button>
            </div>
          </form>
          <div className="sf-header-actions">
            <Link
              href="/favorites"
              className="sf-header-icon-btn"
              aria-label="Избранное"
              title="Избранное"
            >
              <Icon name="heart" />
            </Link>
            <Link
              href="/orders"
              className="sf-header-icon-btn"
              aria-label="Заказы"
              title="Мои заказы"
            >
              <Icon name="box" />
            </Link>
            <CartLink />
            <a
              href="/buyer"
              className="sf-header-icon-btn"
              aria-label="Кабинет покупателя"
              title="Кабинет покупателя и бонусы"
            >
              <Icon name="user" />
            </a>
          </div>
        </div>
      </header>
      <MobileNav />
    </>
  );
}
