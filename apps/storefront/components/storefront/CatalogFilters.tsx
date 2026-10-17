import { query } from '../../lib/public-api';
import { Input, Select, Checkbox, Button, LinkButton } from '../ui';
export default function CatalogFilters({
  filter: f,
  categories,
  slug,
}: {
  filter: ReturnType<typeof query>;
  categories: string[];
  slug?: string;
}) {
  const isFiltered = Boolean(
    f.q ||
    f.category ||
    (f.sort && f.sort !== 'name') ||
    f.minPrice ||
    f.maxPrice ||
    f.inStock,
  );
  return (
    <form
      className="sf-filters"
      action={slug ? '/shops/' + slug : '/'}
      method="get"
    >
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
      <div className="sf-price-range">
        <Input
          id="min-price"
          label="Цена от, сом"
          name="minPrice"
          type="number"
          min="0"
          step="0.01"
          defaultValue={f.minPrice}
        />
        <Input
          id="max-price"
          label="До, сом"
          name="maxPrice"
          type="number"
          min="0"
          step="0.01"
          defaultValue={f.maxPrice}
        />
      </div>
      <Checkbox
        label="В наличии"
        name="inStock"
        value="true"
        defaultChecked={f.inStock}
      />
      <div className="sf-filter-actions">
        <Button type="submit">Найти</Button>
        {isFiltered && (
          <LinkButton
            variant="secondary"
            href={slug ? '/shops/' + slug : '/'}
            className="sf-button--reset"
          >
            Сбросить
          </LinkButton>
        )}
      </div>
    </form>
  );
}
