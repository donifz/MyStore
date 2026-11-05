import { FormEvent, useEffect, useState } from 'react';
import Pagination from '../components/Pagination';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import type { CategoryNode } from './PhotoAssistant';

export default function CategoriesPage() {
  const { shopId } = useParams();
  const allowed =
    useSession().user?.shops.find((s) => s.id === shopId)?.role !== 'cashier';
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'name' | 'custom' | 'builtin'>('name');
  const pageSize = 12;
  const visibleCategories = categories
    .filter((category) =>
      [category.name, ...category.children.map((child) => child.name)].some(
        (name) => name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')),
      ),
    )
    .sort((a, b) =>
      sort === 'custom'
        ? Number(a.builtIn) - Number(b.builtIn) || a.name.localeCompare(b.name, 'ru')
        : sort === 'builtin'
          ? Number(b.builtIn) - Number(a.builtIn) || a.name.localeCompare(b.name, 'ru')
          : a.name.localeCompare(b.name, 'ru'),
    );
  const pages = Math.max(1, Math.ceil(visibleCategories.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pagedCategories = visibleCategories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  async function reload() {
    if (shopId)
      setCategories(await api<CategoryNode[]>(`/shops/${shopId}/categories`));
  }
  useEffect(() => {
    void reload().catch((e) => setError(errorText(e)));
  }, [shopId]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/shops/${shopId}/categories`, {
        method: 'POST',
        body: { name, ...(parentId ? { parentId } : {}) },
      });
      setName('');
      await reload();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="category-page page-stack">
      <Link className="back-link" to={`/seller/${shopId}/products`}>
        ← Товары
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Каталог магазина</p>
          <h1>Категории</h1>
          <p className="muted">
            Готовые категории уже добавлены. Здесь можно создать свои.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="panel category-create">
        <h2>Добавить категорию</h2>
        <form onSubmit={submit}>
          <label>
            Новая категория или подкатегория
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Родительская категория
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">Создать основную категорию</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  Подкатегория в «{c.name}»
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={busy || !allowed}>
            {busy ? 'Сохраняем…' : 'Добавить'}
          </button>
        </form>
      </section>
      <section className="category-list" aria-label="Категории магазина">
        <div className="category-list-heading">
          <h2>Категории магазина</h2>
          <span className="badge">{visibleCategories.length} из {categories.length}</span>
        </div>
        <div className="toolbar">
          <label>
            Поиск категории
            <input
              value={query}
              placeholder="Категория или подкатегория"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Сортировка категорий
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as 'name' | 'custom' | 'builtin');
                setPage(1);
              }}
            >
              <option value="name">По названию</option>
              <option value="custom">Сначала свои</option>
              <option value="builtin">Сначала готовые</option>
            </select>
          </label>
        </div>
        {visibleCategories.length === 0 && (
          <p className="empty-state">{query ? 'Категории не найдены.' : 'Категорий пока нет.'}</p>
        )}
        <div className="category-grid">
          {pagedCategories.map((c) => (
            <article className="panel category-card" key={c.id}>
              <div className="category-card-heading">
                <h3>{c.name}</h3>
                <span className="category-origin">
                  {c.builtIn ? 'Готовая' : 'Своя'}
                </span>
              </div>
              {c.children.length > 0 ? (
                <ul className="category-children">
                  {c.children.map((child) => (
                    <li key={child.id}>{child.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Пока без подкатегорий</p>
              )}
            </article>
          ))}
        </div>
        <Pagination
          page={currentPage}
          total={visibleCategories.length}
          size={pageSize}
          onPage={setPage}
          label="Страницы категорий"
        />
      </section>
    </div>
  );
}
