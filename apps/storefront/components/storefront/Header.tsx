import Link from 'next/link';
import { publicFilters } from '../../lib/public-api';
import { CartLink } from '../CartProvider';
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
          <nav className="sf-top-nav" aria-label="Разделы витрины">
            <Link
              href="/"
              className="sf-top-nav__item sf-top-nav__item--active"
            >
              <Icon name="home" width={16} height={16} />
              <span>Главная</span>
            </Link>
            <Link href="/shops" className="sf-top-nav__item sf-shops-nav">
              <Icon name="box" width={16} height={16} />
              <span>Магазины</span>
            </Link>
            <Link href="/catalog" className="sf-top-nav__item">
              <Icon name="grid" width={16} height={16} />
              <span>Каталог</span>
            </Link>
            <Link href="/?sort=price-asc#catalog" className="sf-top-nav__item">
              <Icon name="star" width={16} height={16} />
              <span>Акции</span>
            </Link>
            <Link href="/?sort=newest#catalog" className="sf-top-nav__item">
              <Icon name="flame" width={16} height={16} />
              <span>Новинки</span>
            </Link>
          </nav>
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
      <nav className="sf-home-mobile-nav" aria-label="Навигация на телефоне">
        <Link href="/">
          <Icon name="home" />
          <span>Главная</span>
        </Link>
        <Link href="/catalog">
          <Icon name="grid" />
          <span>Каталог</span>
        </Link>
        <CartLink />
        <Link href="/orders">
          <Icon name="box" />
          <span>Заказы</span>
        </Link>
        <a href="/buyer">
          <Icon name="user" />
          <span>Кабинет</span>
        </a>
      </nav>
    </>
  );
}
