import { APIRequestContext, expect } from '@playwright/test';

export async function reviewedPartner(
  request: APIRequestContext,
  email: string,
  password: string,
  shopName: string,
) {
  const origin = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001';
  const submitted = await request.post('/api/partners/applications', {
    headers: { origin },
    data: {
      shopName,
      email,
      phone: '+996700123456',
      city: 'Ош',
      address: '',
      category: 'Розница',
      agreed: true,
    },
  });
  expect(submitted.ok()).toBeTruthy();
  const application = await submitted.json();
  const adminLogin = await request.post('/api/auth/login', {
    data: { email: 'owner@example.test', password: 'browser-test-password' },
  });
  expect(adminLogin.ok()).toBeTruthy();
  const admin = (await adminLogin.json()).token;
  const decision = await request.post(
    `/api/platform/admin/applications/${application.id}/decision`,
    {
      headers: { authorization: `Bearer ${admin}` },
      data: { expectedStatus: 'new', decision: 'approved' },
    },
  );
  expect(decision.ok()).toBeTruthy();
  const link = (await decision.json()).activationUrl;
  const token = new URL(link, 'http://local').searchParams.get('token');
  const activated = await request.post('/api/partners/invitations/activate', {
    headers: { origin },
    data: { token, password },
  });
  expect(activated.ok()).toBeTruthy();
  const login = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(login.ok()).toBeTruthy();
  return (await login.json()).token as string;
}

export async function approveProduct(
  request: APIRequestContext,
  variantId: string,
) {
  const admin = (
    await (
      await request.post('/api/auth/login', {
        data: {
          email: 'owner@example.test',
          password: 'browser-test-password',
        },
      })
    ).json()
  ).token;
  const headers = { authorization: `Bearer ${admin}` };
  const queue = await (
    await request.get('/api/platform/admin/products', { headers })
  ).json();
  const pending = queue.items.find(
    (x: { variant_id: string }) => x.variant_id === variantId,
  );
  expect(pending).toBeDefined();
  const decided = await request.post(
    `/api/platform/admin/products/revisions/${pending.revision_id}/decision`,
    {
      headers,
      data: { decision: 'approved' },
    },
  );
  expect(decided.ok()).toBeTruthy();
}
