import Link from 'next/link';
import Icon, { CategoryIllustration } from '../../components/storefront/Icon';
import { metadata } from '../../lib/seo';

export const dynamic = 'force-dynamic';
export const generateMetadata = () =>
  metadata(
    'Каталог категорий — MyStore',
    'Все категории товаров и магазинов MyStore.',
    '/catalog',
  );

const CATALOG_CATEGORIES = [
  {
    title: 'Все категории',
    subtitle: '24 580 товаров во всех магазинах',
    href: '/?inStock=false#catalog',
    bg: '#eaf2ff',
    isAll: true,
    categoryKey: 'Все',
  },
  {
    title: 'Игрушки',
    subtitle: 'Мягкие игрушки, машинки, куклы, конструкторы',
    href: '/shop/mir-igrushek',
    bg: '#fff7ed',
    categoryKey: 'Мягкие игрушки',
  },
  {
    title: 'Конструкторы и LEGO',
    subtitle: 'LEGO, магнитные конструкторы, Marble Run',
    href: '/?category=Конструкторы#catalog',
    bg: '#eff6ff',
    categoryKey: 'Конструкторы',
  },
  {
    title: 'Электроника и робототехника',
    subtitle: 'Наборы Arduino, интерактивные роботы, гаджеты',
    href: '/?category=Развивающие#catalog',
    bg: '#f0f9ff',
    categoryKey: 'Робототехника',
  },
  {
    title: 'Для дома и интерьера',
    subtitle: 'Посуда, свет, уют и декор',
    href: '/?category=Цветы#catalog',
    bg: '#fdf2f8',
    categoryKey: 'Цветы',
  },
  {
    title: 'Кофе, чай и выпечка',
    subtitle: 'Свежеобжаренный кофе, ремесленный хлеб, круассаны',
    href: '/?category=Кофе и чай#catalog',
    bg: '#fffbeb',
    categoryKey: 'Кофе и чай',
  },
  {
    title: 'Развивающие игры и хобби',
    subtitle: 'Настольные игры, опыты, Монтессори',
    href: '/?category=Развивающие#catalog',
    bg: '#f5f3ff',
    categoryKey: 'Настольные игры',
  },
  {
    title: 'Машинки и транспорт',
    subtitle: 'Радиоуправляемые внедорожники, спорткары, поезда',
    href: '/?category=Машинки#catalog',
    bg: '#fef2f2',
    categoryKey: 'Машинки',
  },
  {
    title: 'Куклы и фигурки',
    subtitle: 'Куклы с аксессуарами, коллекционные фигурки',
    href: '/shop/mir-igrushek?category=Куклы#catalog',
    bg: '#fdf4ff',
    categoryKey: 'Куклы',
  },
];

export default function CatalogCategoriesPage() {
  return (
    <div className="sf-stack sf-catalog-page">
      <nav className="sf-breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">Главная</Link>
        <span>›</span>
        <span>Каталог</span>
      </nav>

      <div className="sf-catalog-page-head">
        <h1>Каталог</h1>
        <form action="/" method="get" className="sf-catalog-inline-search">
          <Icon name="search" width={18} height={18} />
          <input
            name="q"
            type="search"
            placeholder="Поиск категории или товара..."
            aria-label="Поиск категории"
          />
        </form>
      </div>

      <div className="sf-catalog-category-list">
        {CATALOG_CATEGORIES.map((cat) => (
          <Link
            key={cat.title}
            href={cat.href}
            className="sf-catalog-category-row"
          >
            <span
              className="sf-catalog-category-icon"
              style={{ background: cat.bg }}
              aria-hidden="true"
            >
              {cat.isAll ? (
                <Icon name="grid" width={26} height={26} />
              ) : (
                <CategoryIllustration category={cat.categoryKey} />
              )}
            </span>
            <span className="sf-catalog-category-copy">
              <strong>{cat.title}</strong>
              <small>{cat.subtitle}</small>
            </span>
            <span className="sf-catalog-category-arrow" aria-hidden="true">
              <Icon name="chevronRight" width={20} height={20} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
