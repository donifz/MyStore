import ProductCard from '../../components/storefront/ProductCard';
import StoreCard from '../../components/storefront/StoreCard';
import Price from '../../components/storefront/Price';
import type { Store, Product } from '../../lib/public-api';
import type { Metadata } from 'next';
import UiKitExamples from '../../components/UiKitExamples';
// The production HTTP wrapper provides a per-request CSP nonce.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'UI-kit MyStore',
  robots: { index: false, follow: false },
};
const colors = [
  ['Фон', '--sf-background', '#F6F8F5'],
  ['Поверхность', '--sf-surface', '#FFFFFF'],
  ['Текст', '--sf-text', '#202C3C'],
  ['Вторичный текст', '--sf-muted', '#586777'],
  ['Основной', '--sf-primary', '#176854'],
  ['Мягкий акцент', '--sf-primary-soft', '#E8F2EC'],
  ['Ошибка', '--sf-danger', '#A82E2E'],
  ['Граница', '--sf-border', '#D9E2DC'],
];
const demoStore: Store = {
  slug: 'demo-store',
  name: 'Мастерская рядом',
  description: 'Красивые вещи для обычных дней.',
  city: 'Бишкек',
};
const demoProducts: Product[] = [
  {
    id: 'demo-cup',
    name: 'Керамическая чашка',
    description: '',
    category: 'Для дома',
    salePriceMinor: 24000,
    available: 3,
    store: demoStore,
  },
  {
    id: 'demo-bag',
    name: 'Сумка для хороших находок',
    description: '',
    category: 'Аксессуары',
    salePriceMinor: 95000,
    available: 0,
    store: demoStore,
  },
];
export default function UiKit() {
  return (
    <div className="sf-ui-kit">
      <section>
        <p className="sf-eyebrow">Система интерфейса · версия 1.0</p>
        <h1>UI-kit MyStore</h1>
        <p className="sf-muted">
          Компоненты для магазинов рядом. Единые правила, доступные состояния и
          адаптивная разметка.
        </p>
        <nav className="sf-actions" aria-label="Разделы UI-kit">
          <a href="#foundations">Основа</a>
          <a href="#buttons">Кнопки</a>
          <a href="#fields">Поля</a>
          <a href="#states">Состояния</a>
        </nav>
      </section>
      <section className="sf-panel sf-kit-section" id="foundations">
        <h2>Цвет и типографика</h2>
        <div className="sf-kit-grid">
          {colors.map(([label, token, hex]) => (
            <div key={token}>
              <div
                className="sf-swatch"
                style={{
                  background: `var(${token})`,
                  color:
                    token === '--sf-primary' ||
                    token === '--sf-text' ||
                    token === '--sf-muted' ||
                    token === '--sf-danger'
                      ? 'var(--sf-surface)'
                      : 'var(--sf-text)',
                }}
              >
                <strong>{label}</strong>
                <small>{hex}</small>
              </div>
              <p className="sf-kit-label">
                <code>{token}</code>
              </p>
            </div>
          ))}
        </div>
        <h3>Найдите своё в магазинах рядом</h3>
        <p>
          Основной текст — 16 px. Подписи — 14 px. Заголовки адаптируются от 28
          до 48 px.
        </p>
      </section>
      <section className="sf-panel">
        <h2>Ритм и отступы</h2>
        <div className="sf-actions">
          {[4, 8, 12, 16, 24, 32, 48, 64].map((n) => (
            <div key={n}>
              <p className="sf-kit-label">{n} px</p>
              <div
                style={{
                  width: n,
                  height: 16,
                  background: 'var(--sf-primary)',
                  borderRadius: 'var(--sf-radius-input)',
                }}
              />
            </div>
          ))}
        </div>
        <p className="sf-muted">
          Поля — 8 px, карточки — 12 px, крупные блоки — 20 px.
        </p>
      </section>
      <section className="sf-kit-section" id="cards">
        <h2>Карточки и шаблоны</h2>
        <p className="sf-muted">
          Демонстрационные данные. Ссылки в примерах карточек отключены.
        </p>
        <div className="sf-kit-grid" inert>
          <div className="sf-product-grid sf-kit-products">
            {demoProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <StoreCard store={demoStore} />
        </div>
        <div className="sf-panel sf-kit-cart">
          <h3>Итог заказа</h3>
          <div className="sf-cart-total">
            <span>Керамическая чашка · 2 шт.</span>
            <Price minor={48000} />
          </div>
          <p className="sf-muted">
            Оплата при получении. Доставка согласуется с магазином.
          </p>
        </div>
      </section>
      <UiKitExamples />
    </div>
  );
}
