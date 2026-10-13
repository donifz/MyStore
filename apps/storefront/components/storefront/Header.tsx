import Link from 'next/link';
import { CartLink } from '../CartProvider';
import Icon from './Icon';
import { publicApi } from '../../lib/public-api';
export default async function Header() {
  let filters: {
    locations: { city: string; district: string }[];
    categories: string[];
  } = { locations: [], categories: [] };
  try {
    filters = await publicApi('/filters');
  } catch {
    /* Header stays usable during API downtime. */
  }
  return (
    <header className="sf-header">
      <div className="sf-container sf-header__inner">
        <Link className="sf-brand" href="/" aria-label="MyStore — главная">
          <span className="sf-brand__mark">m.</span>
          <span>
            MyStore<small>Магазины рядом</small>
          </span>
        </Link>
        <form action="/" className="sf-global-search">
          <label className="sf-city">
            <Icon name="pin" />
            <span className="sf-sr-only">Город</span>
            <select name="city" aria-label="Город">
              <option value="">Все города</option>
              {[...new Set(filters.locations.map((l) => l.city))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="sf-search-box">
            <Icon name="search" />
            <input
              name="q"
              aria-label="Поиск товаров и магазинов"
              placeholder="Поиск товаров и магазинов…"
              maxLength={128}
            />
            <button type="submit" className="sf-button sf-button--primary">
              Найти
            </button>
          </div>
        </form>
        <nav className="sf-header-actions" aria-label="Для покупателей">
          <Link href="/favorites">
            <Icon name="heart" />
            <span>Избранное</span>
          </Link>
          <CartLink />
          <a href="/seller/login">
            <Icon name="user" />
            <span>Войти</span>
          </a>
        </nav>
      </div>
      <div className="sf-category-bar">
        <nav className="sf-container" aria-label="Категории товаров">
          <Link href="/#catalog">
            <Icon name="menu" />
            Все категории
          </Link>
          {filters.categories.slice(0, 8).map((c) => (
            <Link
              key={c}
              href={'/?category=' + encodeURIComponent(c) + '#catalog'}
            >
              {c}
            </Link>
          ))}
          <Link className="sf-shops-nav" href="/shops">
            <Icon name="shop" />
            Магазины
          </Link>
        </nav>
      </div>
    </header>
  );
}
