import Link from 'next/link';
import type { ReactNode } from 'react';
import '../../web/src/styles.css';
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="market-shell">
          <header className="market-header">
            <Link className="market-brand" href="/">
              MyStore<span>Магазины рядом</span>
            </Link>
            <nav aria-label="Для покупателей">
              <Link href="/">Товары</Link>
              <Link href="/shops">Магазины</Link>
            </nav>
            <span className="market-country">Кыргызстан · сом</span>
          </header>
          <main className="market-main">{children}</main>
          <footer className="market-footer">
            <div>
              <Link className="market-brand" href="/">
                MyStore
              </Link>
              <p>Ваши магазины. Актуальное наличие.</p>
            </div>
            <nav aria-label="Для продавцов">
              <Link href="/partner">Стать партнёром</Link>
              <a href="/seller">Войти для продавцов</a>
            </nav>
            <small>Покупку и получение товара согласуйте с магазином.</small>
          </footer>
        </div>
      </body>
    </html>
  );
}
