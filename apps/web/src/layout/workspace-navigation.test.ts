import { expect, it } from 'vitest';
import type { Me, Shop } from '../api/types';
import {
  shopStart,
  workspaceStart,
  workspaceReturn,
  platformSection,
  workspaceContext,
  workspaceMenu,
} from './workspace-navigation';
const owner: Shop = { id: 'own', name: 'Own', role: 'owner' };
function me(shops: Shop[] = [owner], platformAdmin = false): Me {
  return {
    userId: 'u',
    email: 'u@test.tld',
    csrfToken: 'c',
    shops,
    platformAdmin,
  };
}
it('lands each role in its permitted starting page', () => {
  expect(workspaceStart(me([owner], true))).toBe('/platform/admin');
  for (const role of ['owner', 'manager', 'cashier'] as const)
    expect(workspaceStart(me([{ ...owner, role }]))).toBe(
      `/seller/own/${role === 'cashier' ? 'pos' : 'products'}`,
    );
  expect(workspaceStart(me([]))).toBe('/seller?view=shops');
  expect(workspaceStart(me([owner, { ...owner, id: 'second' }]))).toBe(
    '/seller?view=shops',
  );
  expect(shopStart({ ...owner, role: 'cashier' })).toBe('/seller/own/pos');
});
it('accepts permitted deep links and rejects unsafe or role-forbidden return paths', () => {
  expect(workspaceReturn(me(), '/seller/own/products/p/edit?q=1')).toBe(
    '/seller/own/products/p/edit?q=1',
  );
  expect(
    workspaceReturn(me([owner], true), '/platform/admin?section=audit'),
  ).toBe('/platform/admin?section=audit');
  for (const path of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/seller/other/pos',
    '/seller/own/productsevil',
    '/seller/login',
    '/seller/own/../../platform/admin',
    {},
    undefined,
  ])
    expect(workspaceReturn(me(), path)).toBeNull();
  const cashier = me([{ ...owner, role: 'cashier' }]);
  for (const path of [
    '/seller/own/reports',
    '/seller/own/staff',
    '/seller/own/categories',
    '/seller/own/products/new',
    '/seller/own/products/p/edit',
    '/seller/own/receiving',
    '/seller/own/sales/s/return',
    '/platform/admin',
  ])
    expect(workspaceReturn(cashier, path)).toBeNull();
  expect(workspaceReturn(cashier, '/seller/own/sales/s')).toBe(
    '/seller/own/sales/s',
  );
  expect(
    workspaceReturn(me([{ ...owner, role: 'manager' }]), '/seller/own/staff'),
  ).toBeNull();
});
it('resolves platform sections from URLs and defaults unknown input to overview', () => {
  for (const section of [
    'overview',
    'applications',
    'products',
    'audit',
  ] as const)
    expect(platformSection('?section=' + section)).toBe(section);
  expect(platformSection('')).toBe('overview');
  expect(platformSection('?section=unknown')).toBe('overview');
});
it('platform rights never imply shop membership and mixed roles stay scoped', () => {
  expect(workspaceContext(me([], true), '/platform/admin', '')).toEqual({
    kind: 'platform',
  });
  expect(workspaceContext(me([], true), '/seller/foreign/pos', '')).toEqual({
    kind: 'forbidden',
  });
  expect(workspaceContext(me(), '/platform/admin', '')).toEqual({
    kind: 'forbidden',
  });
  const user = me([owner, { ...owner, id: 'cash', role: 'cashier' }]);
  expect(workspaceContext(user, '/seller/cash/staff', '')).toEqual({
    kind: 'forbidden',
  });
  expect(workspaceContext(user, '/seller/cash/pos', '')).toEqual({
    kind: 'shop',
    shop: user.shops[1],
  });
  expect(workspaceContext(me([]), '/seller', '?view=shops')).toEqual({
    kind: 'empty',
  });
  expect(workspaceContext(user, '/seller', '?view=shops')).toEqual({
    kind: 'shops',
  });
});
it('selects exactly one shop leaf without capture/product prefix overlap', () => {
  for (const path of [
    '/seller/own/products',
    '/seller/own/products/new',
    '/seller/own/products/p/edit',
    '/seller/own/products/capture',
    '/seller/own/sales/s/return',
    '/seller/own/orders/o',
  ]) {
    const menu = workspaceMenu({ kind: 'shop', shop: owner }, path, '').flatMap(
      (g) => g.items,
    );
    expect(menu.filter((i) => i.active)).toHaveLength(1);
    if (path.endsWith('capture'))
      expect(menu.find((i) => i.active)?.label).toBe('Товары');
  }
  const cash = workspaceMenu(
    { kind: 'shop', shop: { ...owner, role: 'cashier' } },
    '/seller/own/pos',
    '',
  ).flatMap((g) => g.items);
  expect(cash.some((i) => i.label === 'Сотрудники')).toBe(false);
  expect(cash.some((i) => i.label === 'Продажи и возвраты')).toBe(false);
  expect(cash.some((i) => i.label === 'Продажи')).toBe(true);
  const platform = workspaceMenu(
    { kind: 'platform' },
    '/platform/admin',
    '?section=audit',
  ).flatMap((g) => g.items);
  expect(platform.filter((i) => i.active).map((i) => i.label)).toEqual([
    'Аудит',
  ]);
});
it('preserves legacy shop selection through login for an admin with several memberships', () => {
  const user = me([owner, { ...owner, id: 'second' }], true);
  expect(workspaceReturn(user, '/seller#partner-shops')).toBe(
    '/seller?view=shops',
  );
  expect(workspaceReturn(me([owner], true), '/seller#partner-shops')).toBe(
    '/platform/admin',
  );
  expect(workspaceReturn(me(), '/seller#partner-shops')).toBe(
    '/seller/own/products',
  );
});

it('uses independent report and return permissions without granting staff management', () => {
  const employee = {
    ...owner,
    role: 'cashier' as const,
    canReturn: true,
    canViewReports: true,
  };
  const user = me([employee]);
  expect(workspaceReturn(user, '/seller/own/reports')).toBe(
    '/seller/own/reports',
  );
  expect(workspaceReturn(user, '/seller/own/sales/s/return')).toBe(
    '/seller/own/sales/s/return',
  );
  expect(workspaceReturn(user, '/seller/own/staff')).toBeNull();
  expect(workspaceReturn(user, '/seller/own/receiving')).toBeNull();
  const menu = workspaceMenu(
    { kind: 'shop', shop: employee },
    '/seller/own/reports',
    '',
  );
  expect(menu.flatMap((g) => g.items).map((i) => i.label)).toContain('Отчёты');
  const returnsOnly = me([{ ...employee, canViewReports: false }]);
  expect(workspaceReturn(returnsOnly, '/seller/own/reports')).toBeNull();
  expect(
    workspaceReturn(returnsOnly, '/seller/own/sales/s/return'),
  ).not.toBeNull();
});

it('keeps everyday tasks prominent and advanced tools under More', () => {
  const ownerMenu = workspaceMenu(
    { kind: 'shop', shop: owner },
    '/seller/own/receiving',
    '',
  );
  expect(ownerMenu.map((group) => group.label)).toEqual(['Основное', 'Ещё']);
  expect(ownerMenu[0].items.map((item) => item.label)).toEqual([
    'Касса',
    'Приёмка',
    'Товары',
    'Отчёты',
  ]);
  expect(ownerMenu[1].items.some((item) => item.label === 'Смена')).toBe(true);
  expect(
    ownerMenu[0].items.filter((item) => item.active).map((item) => item.label),
  ).toEqual(['Приёмка']);

  const cashierMenu = workspaceMenu(
    { kind: 'shop', shop: { ...owner, role: 'cashier' } },
    '/seller/own/pos',
    '',
  );
  expect(cashierMenu[0].items.map((item) => item.label)).toEqual([
    'Касса',
    'Товары',
  ]);
  expect(
    cashierMenu.flatMap((group) => group.items).some((item) => item.label === 'Приёмка'),
  ).toBe(false);
  expect(
    cashierMenu.flatMap((group) => group.items).some((item) => item.label === 'Сотрудники'),
  ).toBe(false);
});
