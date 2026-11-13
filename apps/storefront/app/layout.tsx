import type { Metadata, Viewport } from 'next';
import CartProvider from '../components/CartProvider';
import Header from '../components/storefront/Header';
import Footer from '../components/storefront/Footer';
import type { ReactNode } from 'react';
import { publicBase } from '../lib/seo';
import '../styles/tokens.css';
import '../styles/storefront.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
};

export const metadata: Metadata = {
  metadataBase: new URL(publicBase()),
  title: {
    default: 'MyStore — Товары местных магазинов Кыргызстана',
    template: '%s | MyStore',
  },
  description:
    'Маркетплейс и витрина магазинов Кыргызстана. Каталог товаров, актуальные цены, наличие и связь с продавцами.',
  applicationName: 'MyStore',
  keywords: [
    'магазины Бишкек',
    'магазины Ош',
    'товары Кыргызстан',
    'купить в Бишкеке',
    'доставка Кыргызстан',
    'маркетплейс Кыргызстан',
    'MyStore',
  ],
  authors: [{ name: 'MyStore' }],
  creator: 'MyStore',
  publisher: 'MyStore',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.webmanifest',
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  openGraph: {
    title: 'MyStore — Товары местных магазинов Кыргызстана',
    description:
      'Маркетплейс и витрина магазинов Кыргызстана. Цены, актуальное наличие и прямые контакты продавцов.',
    url: publicBase(),
    siteName: 'MyStore',
    locale: 'ru_KG',
    type: 'website',
    images: [{ url: '/osh-hero.webp', alt: 'MyStore' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyStore — Товары местных магазинов Кыргызстана',
    description:
      'Маркетплейс и витрина магазинов Кыргызстана. Цены, актуальное наличие и прямые контакты продавцов.',
    images: ['/osh-hero.webp'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

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
