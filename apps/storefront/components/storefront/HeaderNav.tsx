'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CartLink } from '../CartProvider';
import Icon from './Icon';

type NavKey = 'home' | 'shops' | 'catalog' | 'promo' | 'new';

interface TopNavItem {
  key: NavKey;
  href: string;
  label: string;
  icon: 'home' | 'box' | 'grid' | 'star' | 'flame';
  extraClass?: string;
}

const TOP_NAV_ITEMS: readonly TopNavItem[] = [
  { key: 'home', href: '/', label: 'Главная', icon: 'home' },
  {
    key: 'shops',
    href: '/shops',
    label: 'Магазины',
    icon: 'box',
    extraClass: 'sf-shops-nav',
  },
  { key: 'catalog', href: '/catalog', label: 'Каталог', icon: 'grid' },
  {
    key: 'promo',
    href: '/?sort=price-asc#catalog',
    label: 'Акции',
    icon: 'star',
  },
  {
    key: 'new',
    href: '/?sort=newest#catalog',
    label: 'Новинки',
    icon: 'flame',
  },
];

function getActiveTopNavKey(pathname: string, sort: string): NavKey | null {
  const isCatalogOrHome =
    pathname === '/' ||
    pathname === '/catalog' ||
    pathname.startsWith('/catalog/');

  if (isCatalogOrHome && sort === 'price-asc') return 'promo';
  if (isCatalogOrHome && sort === 'newest') return 'new';
  if (
    pathname === '/shops' ||
    pathname.startsWith('/shops/') ||
    (pathname.startsWith('/shop/') && !pathname.includes('/products/'))
  ) {
    return 'shops';
  }
  if (
    pathname === '/catalog' ||
    pathname.startsWith('/catalog/') ||
    pathname.includes('/products/')
  ) {
    return 'catalog';
  }
  if (pathname === '/') return 'home';
  return null;
}

function TopNavLinks({ activeKey }: { activeKey: NavKey | null }) {
  return (
    <nav className="sf-top-nav" aria-label="Разделы витрины">
      {TOP_NAV_ITEMS.map((item) => {
        const isActive = activeKey === item.key;
        const classes = [
          'sf-top-nav__item',
          item.extraClass,
          isActive ? 'sf-top-nav__item--active' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <Link
            key={item.key}
            href={item.href}
            className={classes}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon name={item.icon} width={16} height={16} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function TopNavDynamic() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const sort = searchParams.get('sort') || '';
  return <TopNavLinks activeKey={getActiveTopNavKey(pathname, sort)} />;
}

/**
 * Top storefront section navigation with active highlight driven by current route and sort tab.
 */
export function TopNav() {
  return (
    <Suspense fallback={<TopNavLinks activeKey={null} />}>
      <TopNavDynamic />
    </Suspense>
  );
}

/**
 * Bottom mobile navigation highlighting the active storefront route.
 */
export function MobileNav() {
  const pathname = usePathname() || '/';
  const isHome = pathname === '/';
  const isCatalog =
    pathname === '/catalog' ||
    pathname.startsWith('/catalog/') ||
    pathname.startsWith('/shops') ||
    pathname.startsWith('/shop/');
  const isOrders = pathname === '/orders' || pathname.startsWith('/orders/');

  return (
    <nav className="sf-home-mobile-nav" aria-label="Мобильная навигация">
      <Link href="/" aria-current={isHome ? 'page' : undefined}>
        <Icon name="home" />
        <span>Главная</span>
      </Link>
      <Link href="/catalog" aria-current={isCatalog ? 'page' : undefined}>
        <Icon name="grid" />
        <span>Каталог</span>
      </Link>
      <CartLink />
      <Link href="/orders" aria-current={isOrders ? 'page' : undefined}>
        <Icon name="box" />
        <span>Заказы</span>
      </Link>
      <a href="/buyer">
        <Icon name="user" />
        <span>Кабинет</span>
      </a>
    </nav>
  );
}

