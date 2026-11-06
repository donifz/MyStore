import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import Pagination from '../components/Pagination';

type ShopCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  createdAt: string;
  linked?: boolean;
  creditApproved?: boolean;
  creditLimitMinor?: number | string;
};
type Page = {
  items: ShopCustomer[];
  total: number;
  page: number;
  pageSize: number;
};
const PAGE_SIZE = 10;

export default function ShopCustomersPage() {
  const { shopId } = useParams();
  const session = useSession();
  const isOwner = session.user?.shops.find((s) => s.id === shopId)?.role === 'owner';
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [invitation, setInvitation] = useState<{
    token: string;
    expiresAt: string;
    name: string;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [creditLimit, setCreditLimit] = useState('5000');

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError('');
    try {
      const result = await api<Page>(
        `/shops/${shopId}/customers?page=${page}&pageSize=${PAGE_SIZE}&q=${encodeURIComponent(query)}`,
      );
      setData(result);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [shopId, query, page, revision]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    setCreateError('');
    try {
      await api(`/shops/${shopId}/customers`, {
        method: 'POST',
        body: { name, phone, address },
      });
      setName('');
      setPhone('');
      setAddress('');
      setPage(1);
      setRevision((value) => value + 1);
    } catch (err) {
      setCreateError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function configureCredit(customer: ShopCustomer, approved: boolean) {
    if (!shopId) return;
    setError('');
    try {
      const limitMinor = approved ? Math.round(Number(creditLimit) * 100) : 0;
      if (!Number.isSafeInteger(limitMinor) || limitMinor < 0) {
        setError('Некорректный лимит кредита');
        return;
      }
      await api(`/shops/${shopId}/customers/${customer.id}/credit-policy`, {
        method: 'POST',
        body: { approved, limitMinor },
      });
      setRevision((n) => n + 1);
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function invite(customer: ShopCustomer) {
    if (!shopId) return;
    setError('');
    setInvitation(null);
    try {
      const issued = await api<{ token: string; expiresAt: string }>(
        `/shops/${shopId}/customers/${customer.id}/invite`,
        { method: 'POST', body: {} },
      );
      setInvitation({ ...issued, name: customer.name });
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="customer-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Покупатели магазина</p>
          <h1>Клиенты</h1>
          <p className="muted">
            Контакты доступны только сотрудникам этого магазина. Создание
            клиента не открывает его личный кабинет.
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>Добавить клиента</h2>
        <form onSubmit={(e) => void create(e)}>
          <div className="customer-form-grid">
            <label>
              Имя
              <input
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Азамат"
              />
            </label>
            <label>
              Номер Кыргызстана
              <input
                required
                type="tel"
                maxLength={32}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+996 700 123 456"
              />
            </label>
            <label>
              Адрес (необязательно)
              <input
                maxLength={500}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ош, улица…"
              />
            </label>
          </div>
          {createError && (
            <p role="alert" className="error">
              {createError}
            </p>
          )}
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Сохраняем…' : 'Добавить клиента'}
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Список клиентов</h2>
        {isOwner && <label>Лимит кредита для одобрения (сом)
          <input type="number" min="0" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
        </label>}
        {invitation && (
          <div className="buyer-message" role="status">
            <strong>Приглашение для {invitation.name}</strong>
            <p>
              Передайте код покупателю лично. Он действителен 15 минут и только
              один раз.
            </p>
            <code
              style={{
                overflowWrap: 'anywhere',
                display: 'block',
                margin: '12px 0',
              }}
            >
              {invitation.token}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(invitation.token);
              }}
            >
              Скопировать код
            </button>
            <button type="button" onClick={() => setInvitation(null)}>
              Скрыть код
            </button>
          </div>
        )}
        <label className="search-label">
          Поиск по имени или номеру
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Имя или +996…"
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Загрузка…</p>
        ) : (
          data && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Клиент</th>
                      <th>Телефон</th>
                      <th>Адрес</th>
                      <th>Добавлен</th>
                      <th>Кабинет</th>
                      {isOwner && <th>Кредит</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.phone}</td>
                        <td>{c.address || '—'}</td>
                        <td>
                          {new Date(c.createdAt).toLocaleDateString('ru-KG')}
                        </td>
                        <td>
                          {c.linked ? (
                            'Привязан'
                          ) : (
                            <button
                              type="button"
                              onClick={() => void invite(c)}
                            >
                              Выдать код
                            </button>
                          )}
                        </td>
                        {isOwner && <td>
                          {c.creditApproved ? (
                            <button type="button" onClick={() => void configureCredit(c, false)}>Лимит {Number(c.creditLimitMinor || 0) / 100} сом · отключить</button>
                          ) : c.linked ? (
                            <button type="button" onClick={() => void configureCredit(c, true)}>Разрешить кредит</button>
                          ) : 'Сначала привяжите кабинет'}
                        </td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.items.length && (
                <p className="muted">Клиенты не найдены.</p>
              )}
              <Pagination
                page={data.page}
                size={data.pageSize}
                total={data.total}
                onPage={setPage}
              />
            </>
          )
        )}
      </section>
      <p className="muted">
        Покупатель должен войти в свой кабинет с тем же номером и использовать
        одноразовый код. Разрешать кредит и устанавливать лимиты может только владелец магазина.
      </p>
    </div>
  );
}
