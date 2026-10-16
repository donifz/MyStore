const { Client } = require('pg');
const { randomUUID } = require('crypto');

const dbUrl =
  process.env.DATABASE_URL ||
  'postgresql://mystore:local-hours-check@127.0.0.1:55439/mystore_hours_test';

async function seed() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log('Connected to DB:', dbUrl);

  const shop1Id = randomUUID();
  const shop2Id = randomUUID();
  const shop3Id = randomUUID();

  await client.query(
    `INSERT INTO shops (id, name, slug, description, city, district, address, phone, hours, published, pickup_enabled, delivery_enabled)
     VALUES
       ($1, 'Bishkek Coffee Roasters', 'bishkek-coffee', 'Свежеобжаренный спешелти кофе и аксессуары для заваривания', 'Бишкек', 'Первомайский', 'ул. Киевская 114', '+996 555 123 456', '08:00 - 20:00', true, true, true),
       ($2, 'Пекарня «Тесто & Мёд»', 'testo-i-med', 'Хрустящая свежая выпечка, ремесленный хлеб и десерты каждого утра', 'Бишкек', 'Октябрьский', 'ул. Юнусалиева 142', '+996 700 987 654', '08:30 - 21:00', true, true, false),
       ($3, 'Цветочный Дворик', 'tsvetochniy-dvorik', 'Авторские свежие букеты, комнатные растения и праздничный декор', 'Бишкек', 'Свердловский', 'пр. Чуй 48', '+996 777 234 567', '09:00 - 21:00', true, true, true)
     ON CONFLICT (slug) DO UPDATE SET published = true, city = EXCLUDED.city, phone = EXCLUDED.phone;`,
    [shop1Id, shop2Id, shop3Id],
  );

  const s1 = (
    await client.query("SELECT id FROM shops WHERE slug='bishkek-coffee'")
  ).rows[0].id;
  const s2 = (
    await client.query("SELECT id FROM shops WHERE slug='testo-i-med'")
  ).rows[0].id;
  const s3 = (
    await client.query("SELECT id FROM shops WHERE slug='tsvetochniy-dvorik'")
  ).rows[0].id;

  const items = [
    {
      id: randomUUID(),
      shopId: s1,
      name: 'Кофе Colombia Supremo свежей обжарки 250г',
      barcode: 'BAR-COF-01',
      price: 65000,
      desc: 'Яркий баланс молочного шоколада, спелого яблока и карамели. Обжарка под фильтр и эспрессо.',
      cat: 'Кофе и чай',
      subcat: 'Зерновой кофе',
      qty: 18,
    },
    {
      id: randomUUID(),
      shopId: s1,
      name: 'Дрип-пакеты Ethiopia Yirgacheffe (10 шт)',
      barcode: 'BAR-COF-02',
      price: 72000,
      desc: 'Удобный формат для дома и офиса. Цветочный аромат бергамота, цитрусовые ноты и сладкое послевкусие.',
      cat: 'Кофе и чай',
      subcat: 'Дрип-кофе',
      qty: 12,
    },
    {
      id: randomUUID(),
      shopId: s2,
      name: 'Круассан классический на сливочном масле',
      barcode: 'BAR-BAK-01',
      price: 12000,
      desc: 'Французская слоёная текстура, золотистая хрустящая корочка и нежный сливочный мякиш.',
      cat: 'Выпечка',
      subcat: 'Круассаны',
      qty: 25,
    },
    {
      id: randomUUID(),
      shopId: s2,
      name: 'Ремесленный тартин на закваске 600г',
      barcode: 'BAR-BAK-02',
      price: 18000,
      desc: 'Длительное холодное брожение 24 часа. Плотная карамелизованная корочка и пористый мякиш.',
      cat: 'Выпечка',
      subcat: 'Хлеб',
      qty: 14,
    },
    {
      id: randomUUID(),
      shopId: s3,
      name: 'Букет сезонных пионов и эвкалипта',
      barcode: 'BAR-FLW-01',
      price: 145000,
      desc: 'Нежные пастельные бутоны в объёмном крафтовом оформлении с веточками свежего эвкалипта.',
      cat: 'Цветы',
      subcat: 'Букеты',
      qty: 6,
    },
    {
      id: randomUUID(),
      shopId: s3,
      name: 'Композиция из белых роз в шляпной коробке',
      barcode: 'BAR-FLW-02',
      price: 189000,
      desc: 'Элегантные отборные эквадорские розы в стильной бархатной коробке с оазисом для свежести.',
      cat: 'Цветы',
      subcat: 'Композиции',
      qty: 5,
    },
  ];

  for (const item of items) {
    const existingVar = (
      await client.query(
        'SELECT id FROM variants WHERE shop_id = $1 AND barcode = $2',
        [item.shopId, item.barcode],
      )
    ).rows[0];

    let variantId = existingVar ? existingVar.id : item.id;

    if (!existingVar) {
      await client.query(
        `INSERT INTO variants (id, shop_id, name, barcode, sale_price_minor, description, category, published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [
          variantId,
          item.shopId,
          item.name,
          item.barcode,
          item.price,
          item.desc,
          item.cat,
        ],
      );
    } else {
      await client.query(
        `UPDATE variants SET name=$1, sale_price_minor=$2, description=$3, category=$4, published=true
         WHERE id=$5`,
        [item.name, item.price, item.desc, item.cat, variantId],
      );
    }

    await client.query(
      `INSERT INTO product_publications (variant_id, shop_id, name, description, category, subcategory)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (variant_id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, category=EXCLUDED.category, subcategory=EXCLUDED.subcategory`,
      [variantId, item.shopId, item.name, item.desc, item.cat, item.subcat],
    );

    await client.query(
      `INSERT INTO stock_balances (shop_id, variant_id, physical, reserved, stock_value_minor)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (shop_id, variant_id) DO UPDATE SET physical=$3`,
      [item.shopId, variantId, item.qty, item.price * item.qty],
    );
  }

  const shopsCount = await client.query(
    'SELECT count(*)::int total FROM shops WHERE published=true',
  );
  const productsCount = await client.query(
    'SELECT count(*)::int total FROM product_publications',
  );
  console.log(
    `Seeding complete: ${shopsCount.rows[0].total} shops, ${productsCount.rows[0].total} products.`,
  );

  await client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
