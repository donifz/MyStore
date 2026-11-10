'use client';
import { useState } from 'react';
import Link from 'next/link';
import { query } from '../../lib/public-api';
import { Input, Select, Checkbox, Button } from '../ui';
import Icon from './Icon';

const STORE_SIDEBAR_CATS = [
  { name: 'Конструкторы', count: 142, icon: 'box' },
  { name: 'Робототехника', count: 48, icon: 'bolt' },
  { name: 'Развивающие', count: 96, icon: 'sparkles' },
  { name: 'Настольные игры', count: 58, icon: 'grid' },
  { name: 'Машинки и транспорт', count: 74, icon: 'truck' },
  { name: 'Куклы и фигурки', count: 52, icon: 'heart' },
];

const RATING_OPTIONS = [
  { label: '4,5 и выше', value: '4.5' },
  { label: '4,0 и выше', value: '4.0' },
  { label: '3,5 и выше', value: '3.5' },
];

const SLIDER_MIN = 0;
const SLIDER_MAX = 10000;

export default function CatalogFilters({
  filter: f,
  categories,
  slug,
}: {
  filter: ReturnType<typeof query>;
  categories: string[];
  slug?: string;
}) {
  const isStore = Boolean(slug);

  const [openSections, setOpenSections] = useState({
    categories: true,
    price: true,
    stock: true,
    rating: false,
  });
  const [selectedRating, setSelectedRating] = useState<string>(
    f.minRating ?? '',
  );

  const [minPriceStr, setMinPriceStr] = useState<string>(f.minPrice ?? '');
  const [maxPriceStr, setMaxPriceStr] = useState<string>(f.maxPrice ?? '');

  const parsedMin = Number(minPriceStr);
  const parsedMax = Number(maxPriceStr);
  const sliderMinVal =
    minPriceStr !== '' && Number.isFinite(parsedMin)
      ? Math.max(SLIDER_MIN, Math.min(parsedMin, SLIDER_MAX))
      : 100;
  const sliderMaxVal =
    maxPriceStr !== '' && Number.isFinite(parsedMax)
      ? Math.max(sliderMinVal, Math.min(parsedMax, SLIDER_MAX))
      : 10000;

  const leftPercent =
    ((sliderMinVal - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
  const rightPercent =
    ((sliderMaxVal - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <form
      className={isStore ? 'sf-filters sf-filters--store' : 'sf-filters'}
      action={slug ? '/shop/' + slug : '/'}
      method="get"
    >
      <Link
        href={slug ? '/shop/' + slug : '/?inStock=false#catalog'}
        className="sf-filter-reset-top"
        onClick={() => {
          setMinPriceStr('');
          setMaxPriceStr('');
          setSelectedRating('');
        }}
      >
        Сбросить
      </Link>
      {isStore && (
        <div className="sf-sidebar-categories sf-sidebar-categories--store">
          <button
            type="button"
            className="sf-filter-group-head sf-filter-group-toggle"
            aria-expanded={openSections.categories}
            onClick={() => toggleSection('categories')}
          >
            <span className="sf-field__label">Категории</span>
            <Icon
              name="chevronDown"
              width={15}
              height={15}
              className={openSections.categories ? 'sf-chevron-up' : ''}
            />
          </button>
          {openSections.categories && (
            <div className="sf-sidebar-cat-list">
              <Link
                href={`/shop/${slug}#catalog`}
                className={`sf-store-nav-cat ${!f.category ? 'sf-store-nav-cat--active' : ''}`}
              >
                <Icon name="grid" width={16} height={16} />
                <span className="sf-sidebar-cat-name">Все товары</span>
                <small className="sf-sidebar-cat-count">(624)</small>
              </Link>
              {STORE_SIDEBAR_CATS.map((item) => (
                <Link
                  key={item.name}
                  href={`/shop/${slug}?category=${encodeURIComponent(item.name)}#catalog`}
                  className={`sf-store-nav-cat ${f.category === item.name ? 'sf-store-nav-cat--active' : ''}`}
                >
                  <Icon name={item.icon} width={16} height={16} />
                  <span className="sf-sidebar-cat-name">{item.name}</span>
                  <small className="sf-sidebar-cat-count">({item.count})</small>
                </Link>
              ))}
              <Link
                href={`/catalog`}
                className="sf-store-nav-cat sf-store-nav-cat--more"
              >
                <span className="sf-dots-glyph" aria-hidden="true">
                  •••
                </span>
                <span className="sf-sidebar-cat-name">Ещё категории</span>
                <Icon name="chevronRight" width={14} height={14} />
              </Link>
            </div>
          )}
        </div>
      )}
      <div className="sf-price-filter-group">
        <button
          type="button"
          className="sf-filter-group-head sf-filter-group-toggle"
          aria-expanded={openSections.price}
          onClick={() => toggleSection('price')}
        >
          <span className="sf-field__label">Цена, сом</span>
          <Icon
            name="chevronDown"
            width={15}
            height={15}
            className={openSections.price ? 'sf-chevron-up' : ''}
          />
        </button>
        {openSections.price && (
          <>
            <div className="sf-price-range">
              <Input
                id="min-price"
                label="Цена от, сом"
                name="minPrice"
                type="number"
                min="0"
                step="1"
                placeholder="От 100"
                value={minPriceStr}
                onChange={(e) => setMinPriceStr(e.target.value)}
              />
              <Input
                id="max-price"
                label="До, сом"
                name="maxPrice"
                type="number"
                min="0"
                step="1"
                placeholder="До 10 000"
                value={maxPriceStr}
                onChange={(e) => setMaxPriceStr(e.target.value)}
              />
            </div>
            <div className="sf-dual-range-slider">
              <div className="sf-dual-range-track-bg" />
              <div
                className="sf-dual-range-track-fill"
                style={{
                  left: `${leftPercent}%`,
                  width: `${Math.max(0, rightPercent - leftPercent)}%`,
                }}
              />
              <input
                type="range"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={50}
                value={sliderMinVal}
                aria-label="Минимальная цена"
                className="sf-dual-range-input sf-dual-range-input--min"
                onChange={(e) => {
                  const next = Math.min(
                    Number(e.target.value),
                    sliderMaxVal - 50,
                  );
                  setMinPriceStr(String(Math.max(0, next)));
                }}
              />
              <input
                type="range"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={50}
                value={sliderMaxVal}
                aria-label="Максимальная цена"
                className="sf-dual-range-input sf-dual-range-input--max"
                onChange={(e) => {
                  const next = Math.max(
                    Number(e.target.value),
                    sliderMinVal + 50,
                  );
                  setMaxPriceStr(String(next));
                }}
              />
            </div>
          </>
        )}
      </div>
      {!isStore && categories.length > 0 && (
        <div className="sf-sidebar-categories">
          <button
            type="button"
            className="sf-filter-group-head sf-filter-group-toggle"
            aria-expanded={openSections.categories}
            onClick={() => toggleSection('categories')}
          >
            <span className="sf-field__label">Категории</span>
            <Icon
              name="chevronDown"
              width={15}
              height={15}
              className={openSections.categories ? 'sf-chevron-up' : ''}
            />
          </button>
          {openSections.categories && (
            <div className="sf-sidebar-cat-list">
              <Link
                href="/#catalog"
                className={`sf-sidebar-cat-item ${!f.category ? 'sf-sidebar-cat-item--active' : ''}`}
              >
                <span className="sf-sidebar-check" aria-hidden="true">
                  {!f.category ? '✓' : ''}
                </span>
                <span className="sf-sidebar-cat-name">Все категории</span>
              </Link>
              {categories.map((c) => (
                <Link
                  key={c}
                  href={`/?category=${encodeURIComponent(c)}#catalog`}
                  className={`sf-sidebar-cat-item ${f.category === c ? 'sf-sidebar-cat-item--active' : ''}`}
                >
                  <span className="sf-sidebar-check" aria-hidden="true">
                    {f.category === c ? '✓' : ''}
                  </span>
                  <span className="sf-sidebar-cat-name">{c}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      <div
        className={
          isStore
            ? 'sf-filter-section sf-filter-section--stock-toggle'
            : `sf-filter-section ${!openSections.stock ? 'sf-filter-section--collapsed' : ''}`
        }
      >
        {isStore ? (
          <div className="sf-filter-group-head">
            <span className="sf-field__label">Только в наличии</span>
          </div>
        ) : (
          <button
            type="button"
            className="sf-filter-group-head sf-filter-group-toggle"
            aria-expanded={openSections.stock}
            onClick={() => toggleSection('stock')}
          >
            <span className="sf-field__label">Наличие</span>
            <Icon
              name="chevronDown"
              width={15}
              height={15}
              className={openSections.stock ? 'sf-chevron-up' : ''}
            />
          </button>
        )}
        {(isStore || openSections.stock) && (
          <Checkbox
            label="В наличии"
            name="inStock"
            value="true"
            defaultChecked={isStore ? true : f.inStock}
          />
        )}
      </div>
      {!isStore && (
        <div
          className={`sf-filter-section ${!openSections.rating ? 'sf-filter-section--collapsed' : ''}`}
        >
          <button
            type="button"
            className="sf-filter-group-head sf-filter-group-toggle"
            aria-expanded={openSections.rating}
            onClick={() => toggleSection('rating')}
          >
            <span className="sf-field__label">Рейтинг</span>
            <Icon
              name="chevronDown"
              width={15}
              height={15}
              className={openSections.rating ? 'sf-chevron-up' : ''}
            />
          </button>
          {openSections.rating && (
            <div className="sf-sidebar-cat-list">
              {RATING_OPTIONS.map((r) => {
                const active = selectedRating === r.value;
                return (
                  <button
                    key={r.label}
                    type="button"
                    className={`sf-sidebar-cat-item sf-sidebar-cat-btn ${active ? 'sf-sidebar-cat-item--active' : ''}`}
                    onClick={() =>
                      setSelectedRating((prev) =>
                        prev === r.value ? '' : r.value,
                      )
                    }
                  >
                    <span className="sf-sidebar-check" aria-hidden="true">
                      {active ? '✓' : ''}
                    </span>
                    <span className="sf-sidebar-cat-name">★ {r.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          {selectedRating && (
            <input type="hidden" name="minRating" value={selectedRating} />
          )}
        </div>
      )}
      <div className="sf-filter-section">
        <Input
          id="catalog-search"
          label="Поиск"
          name="q"
          defaultValue={f.q}
          maxLength={128}
          placeholder="Название, артикул или магазин"
        />
        <Select
          id="catalog-category"
          label="Категория"
          name="category"
          defaultValue={f.category}
        >
          <option value="">Все категории</option>
          {f.category && !categories.includes(f.category) && (
            <option>{f.category}</option>
          )}
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select
          id="catalog-sort"
          label="Сортировка"
          name="sort"
          defaultValue={f.sort}
        >
          <option value="name">По названию</option>
          <option value="newest">Сначала новые</option>
          <option value="price-asc">Сначала дешевле</option>
          <option value="price-desc">Сначала дороже</option>
        </Select>
        {f.city && <input type="hidden" name="city" value={f.city} />}
      </div>
      <div className="sf-filter-actions">
        <Button type="submit">Найти</Button>
      </div>
    </form>
  );
}
