import Link from 'next/link';
import { CartLink } from '../CartProvider';
export default function Header() {
  return (
    <header className="sf-header">
      <div className="sf-container sf-header__inner">
        <Link className="sf-brand" href="/" aria-label="MyStore — главная">
          <span className="sf-brand__mark" aria-hidden="true">
            m.
          </span>
          <span>
            MyStore<small>Магазины рядом</small>
          </span>
        </Link>
        <nav className="sf-nav" aria-label="Для покупателей">
          <Link href="/">Товары</Link>
          <Link href="/shops">Магазины</Link>
          <CartLink />
        </nav>
        <span className="sf-location">
          Кыргызстан <span aria-hidden="true">·</span> сом
        </span>
      </div>
    </header>
  );
}
