import { FormEvent, useEffect, useState } from 'react';
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
    <>
      <Link className="back-link" to={`/seller/${shopId}/products`}>
        ← Товары
      </Link>
      <h1>Категории</h1>
      <p className="muted">
        Готовые категории уже добавлены. Можно создавать свои и подкатегории.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="panel">
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
      <section className="panel">
        <ul>
          {categories.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              {c.builtIn ? ' · готовая' : ' · своя'}
              {c.children.length > 0 && (
                <ul>
                  {c.children.map((child) => (
                    <li key={child.id}>{child.name}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
