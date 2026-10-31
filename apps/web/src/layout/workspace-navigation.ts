import { hasShopPermission, type Me, type Shop, type Role } from '../api/types';
export type PlatformSection =
  'overview' | 'applications' | 'products' | 'audit' | 'financial-access';
export type WorkspaceContext =
  | { kind: 'platform' }
  | { kind: 'shop'; shop: Shop }
  | { kind: 'shops' }
  | { kind: 'empty' }
  | { kind: 'forbidden' };
export type WorkspaceMenuGroup = {
  label: string;
  items: { label: string; href: string; active: boolean }[];
};
const all: Role[] = ['owner', 'manager', 'cashier'],
  catalog: Role[] = ['owner', 'manager'];
const sections: PlatformSection[] = [
  'overview',
  'applications',
  'products',
  'audit',
  'financial-access',
];
const shopRoutes: { pattern: RegExp; roles: Role[] }[] = [
  { pattern: /^(?:pos|shift|labels|operations)$/, roles: all },
  { pattern: /^orders(?:\/[^/]+)?$/, roles: all },
  { pattern: /^sales(?:\/[^/]+)?$/, roles: all },
  { pattern: /^products$/, roles: all },
  { pattern: /^products\/(?:new|capture|[^/]+\/edit)$/, roles: catalog },
  { pattern: /^(?:categories|receiving|inventory)$/, roles: catalog },
  { pattern: /^(?:staff|storefront|platform-access)$/, roles: ['owner'] },
];
export function shopStart(shop: Shop) {
  return `/seller/${shop.id}/${shop.role === 'cashier' ? 'pos' : 'products'}`;
}
export function workspaceStart(me: Me) {
  return me.platformAdmin
    ? '/platform/admin'
    : me.shops.length === 1
      ? shopStart(me.shops[0])
      : '/seller?view=shops';
}
export function platformSection(search: string): PlatformSection {
  const section = new URLSearchParams(search).get('section');
  return sections.includes(section as PlatformSection)
    ? (section as PlatformSection)
    : 'overview';
}
export function workspaceContext(
  me: Me,
  pathname: string,
  _search: string,
): WorkspaceContext {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/platform/admin')
    return me.platformAdmin ? { kind: 'platform' } : { kind: 'forbidden' };
  if (path === '/seller')
    return me.shops.length ? { kind: 'shops' } : { kind: 'empty' };
  const match = path.match(/^\/seller\/([^/]+)(?:\/(.*))?$/);
  const shop = me.shops.find((s) => s.id === match?.[1]);
  if (!shop) return { kind: 'forbidden' };
  if (
    !match?.[2] ||
    (match[2] === 'reports' && hasShopPermission(shop, 'reports')) ||
    (/^sales\/[^/]+\/return$/.test(match[2]) &&
      hasShopPermission(shop, 'return')) ||
    shopRoutes.some(
      (r) => r.pattern.test(match[2]) && r.roles.includes(shop.role),
    )
  )
    return { kind: 'shop', shop };
  return { kind: 'forbidden' };
}
export function workspaceReturn(me: Me, from: unknown): string | null {
  if (
    typeof from !== 'string' ||
    !from.startsWith('/') ||
    /[\u0000-\u0020\\]/.test(from)
  )
    return null;
  try {
    const url = new URL(from, 'https://workspace.invalid');
    if (
      url.origin !== 'https://workspace.invalid' ||
      workspaceContext(me, url.pathname, url.search).kind === 'forbidden'
    )
      return null;
    if (url.pathname === '/seller' && url.hash === '#partner-shops')
      return me.shops.length > 1 ? '/seller?view=shops' : workspaceStart(me);
    if (
      url.pathname === '/seller' &&
      new URLSearchParams(url.search).get('view') !== 'shops'
    )
      return workspaceStart(me);
    const context = workspaceContext(me, url.pathname, url.search);
    if (
      context.kind === 'shop' &&
      url.pathname.replace(/\/$/, '') === `/seller/${context.shop.id}`
    )
      return shopStart(context.shop);
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
export function workspaceMenu(
  context: WorkspaceContext,
  pathname: string,
  search: string,
): WorkspaceMenuGroup[] {
  if (context.kind === 'forbidden') return [];
  if (context.kind === 'platform')
    return [
      {
        label: 'Платформа',
        items: sections.map((section, i) => ({
          label: [
            'Обзор',
            'Партнёры',
            'Модерация товаров',
            'Аудит',
            'Финансовый доступ',
          ][i],
          href: `/platform/admin?section=${section}`,
          active: platformSection(search) === section,
        })),
      },
    ];
  if (context.kind !== 'shop')
    return [
      {
        label: 'Кабинет',
        items: [
          {
            label: context.kind === 'empty' ? 'Доступ' : 'Мои магазины',
            href: '/seller?view=shops',
            active: true,
          },
        ],
      },
    ];
  const { shop } = context,
    base = `/seller/${shop.id}`;
  const relative = pathname.slice(base.length + 1).replace(/\/$/, '');
  const item = (label: string, route: string, pattern: RegExp) => ({
    label,
    href: `${base}/${route}`,
    active: pattern.test(relative),
  });
  const primary = [
    item('Касса', 'pos', /^pos$/),
    ...(shop.role !== 'cashier'
      ? [item('Приёмка', 'receiving', /^receiving$/)]
      : []),
    item('Товары', 'products', /^products(?:\/(?:new|capture|[^/]+\/edit))?$/),
    ...(hasShopPermission(shop, 'reports')
      ? [item('Отчёты', 'reports', /^reports$/)]
      : []),
  ];
  const more = [
    item('Смена', 'shift', /^shift$/),
    item(
      hasShopPermission(shop, 'return') ? 'Продажи и возвраты' : 'Продажи',
      'sales',
      /^sales(?:\/.*)?$/,
    ),
    item('Заказы', 'orders', /^orders(?:\/.*)?$/),
    item('Печать этикеток', 'labels', /^labels$/),
    ...(shop.role !== 'cashier'
      ? [
          item('Категории', 'categories', /^categories$/),
          item('Инвентаризация', 'inventory', /^inventory$/),
        ]
      : []),
    ...(shop.role === 'owner'
      ? [
          item('Витрина', 'storefront', /^storefront$/),
          item('Сотрудники', 'staff', /^staff$/),
          item('Доступ платформы', 'platform-access', /^platform-access$/),
        ]
      : []),
    item('Уведомления', 'operations', /^operations$/),
  ];
  return [
    { label: 'Основное', items: primary },
    { label: 'Ещё', items: more },
  ];
}
