const { createServer } = require('node:http');
const { resolve } = require('node:path');
process.env.PORT = '43100';
const app = require('next')({
  dev: true,
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
  presentation: {
    id: 'nooruz',
    startsAt: null,
    endsAt: null,
    hero: {
      title: 'Нооруз майрамы',
      text: 'Праздничная подборка магазина',
      link: '/?category=Посуда',
      buttonLabel: 'Смотреть товары',
    },
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
