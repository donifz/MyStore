import CartProvider from '../components/CartProvider';
import Header from '../components/storefront/Header';
import Footer from '../components/storefront/Footer';
import type { ReactNode } from 'react';
import '../styles/tokens.css';
import '../styles/storefront.css';
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="sf-page">
        <CartProvider>
          <a className="sf-skip" href="#content">
            К содержимому
          </a>
          <Header />
          <main id="content" className="sf-container sf-main">
            {children}
          </main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
