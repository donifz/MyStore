import { query } from '../../lib/public-api';
import { Input, Select, Checkbox, Button } from '../ui';
export default function CatalogFilters({
  filter: f,
  categories,
  slug,
}: {
  filter: ReturnType<typeof query>;
  categories: string[];
  slug?: string;
}) {
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
        placeholder="Что вы ищете?"
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
        <option value="price-asc">Сначала дешевле</option>
        <option value="price-desc">Сначала дороже</option>
      </Select>
      <Checkbox
        label="В наличии"
        name="inStock"
        value="true"
        defaultChecked={f.inStock}
      />
      <Button type="submit">Найти</Button>
    </form>
  );
}
