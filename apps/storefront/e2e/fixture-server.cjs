const { createServer } = require('node:http');
const { resolve } = require('node:path');
process.env.PORT = '43100';
const app = require('next')({
  dev: process.env.NEXT_DEV === 'true',
  webpack: true,
  dir: resolve(__dirname, '..'),
  hostname: '127.0.0.1',
  port: 43100,
});
const handler = app.getRequestHandler();
const store = {
  slug: 'shop-a',
  name: 'Магазин у дома',
  description: 'Посуда для тёплых встреч',
  city: 'Ош',
  phone: '+996700123456',
  address: 'Центр',
  hours: '10–19',
  district: '',
  pickupEnabled: true,
  deliveryEnabled: false,
  productCount: 1,
  categories: ['Посуда'],
  banner: {
    imageDataUrl:
      'data:image/jpeg;base64,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',
  },
};
const product = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Керамическая чашка',
  description: 'Для вашего любимого кофе.\nОбъём: 250 мл.',
  category: 'Посуда',
  salePriceMinor: 24000,
  available: 3,
  store,
};
app
  .prepare()
  .then(() =>
    createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') {
        res.end('ok');
        return;
      }
      if (!url.pathname.startsWith('/api/public/')) return handler(req, res);
      res.setHeader('Content-Type', 'application/json');
      if (url.searchParams.get('q') === 'outage') {
        res.statusCode = 503;
        return res.end('{}');
      }
      if (url.pathname === '/api/public/filters')
        return res.end(
          JSON.stringify({
            locations: [{ city: 'Ош', district: '' }],
            categories: ['Посуда'],
          }),
        );
      const item = { ...product, store: { ...store } };
      if (url.searchParams.get('q') === 'broken-image')
        item.photoUrl = 'data:image/jpeg;base64,broken';
      if (url.searchParams.get('q') === 'long')
        item.name = 'ДлинноеНазвание'.repeat(20);
      if (
        url.pathname.includes('long-store') ||
        url.searchParams.get('store') === 'long-store'
      ) {
        item.store.slug = 'long-store';
        item.store.name = 'Магазин'.repeat(20);
      }
      if (url.pathname.includes('no-phone')) {
        item.id = '22222222-2222-4222-8222-222222222222';
        item.store.slug = 'no-phone';
        item.store.name = 'Магазин без телефона';
        delete item.store.phone;
      }
      if (url.pathname.endsWith('/sold-out')) item.available = 0;
      if (url.pathname === '/api/public/products')
        return res.end(
          JSON.stringify({
            items:
              url.searchParams.get('q') === 'empty' ||
              url.searchParams.get('page') === '2'
                ? []
                : url.searchParams.get('q') === 'layout'
                  ? [
                      item,
                      {
                        ...item,
                        id: '22222222-2222-4222-8222-222222222222',
                        name: 'Принтер с очень длинным названием для проверки карточки',
                      },
                      {
                        ...item,
                        id: '33333333-3333-4333-8333-333333333333',
                        name: 'Пульт',
                        available: 0,
                      },
                      {
                        ...item,
                        id: '44444444-4444-4444-8444-444444444444',
                        name: 'Розетка',
                        category: 'Электроника',
                      },
                    ]
                  : url.searchParams.get('category') === 'Посуда'
                    ? [
                        item,
                        {
                          ...item,
                          id: '55555555-5555-4555-8555-555555555555',
                          name: 'Чайник для проверки похожих товаров',
                        },
                      ]
                    : [item],
            total: url.searchParams.get('q') === 'empty' ? 0 : 30,
            page: Number(url.searchParams.get('page') || 1),
            pageSize: 24,
            categories: ['Посуда'],
          }),
        );
      if (url.pathname === '/api/public/stores')
        return res.end(
          JSON.stringify({
            items: [store],
            total: 1,
            page: 1,
            pageSize: 24,
          }),
        );
      if (url.pathname.endsWith('/custom-attributes'))
        return res.end(JSON.stringify([]));
      if (url.pathname === '/api/public/hero-slides')
        return res.end(JSON.stringify([]));
      if (url.pathname.includes('/products/'))
        return res.end(JSON.stringify(item));
      if (url.pathname.startsWith('/api/public/stores/'))
        return res.end(JSON.stringify(item.store));
      res.end('{}');
    }).listen(43100, '127.0.0.1'),
  )
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
