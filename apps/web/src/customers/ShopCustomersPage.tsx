import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import Pagination from '../components/Pagination';
import BuyerActivationPanel from './BuyerActivationPanel';
import {
  formatKyrgyzPhoneInput,
  KYRGYZ_PHONE_PATTERN,
} from './kyrgyzPhoneMask';

type ShopCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  createdAt: string;
  linked?: boolean;
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
    customerId: string;
    token: string;
    expiresAt: string;
    name: string;
  } | null>(null);
  const [revision, setRevision] = useState(0);

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
      const customer = await api<{ id: string; name: string }>(
        `/shops/${shopId}/customers`,
        {
          method: 'POST',
          body: { name: name.trim() || 'Покупатель', phone, address },
        },
      );
      setName('');
      setPhone('');
      setAddress('');
      setPage(1);
      setRevision((value) => value + 1);
      try {
        const issued = await api<{ token: string; expiresAt: string }>(
          `/shops/${shopId}/customers/${customer.id}/invite`,
          { method: 'POST', body: {} },
        );
        setInvitation({
          ...issued,
          customerId: customer.id,
          name: customer.name,
        });
      } catch (err) {
        setCreateError(
          'Клиент создан, но приглашение не удалось выдать: ' + errorText(err),
        );
      }
    } catch (err) {
      setCreateError(errorText(err));
    } finally {
      setSaving(false);
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
      setInvitation({
        ...issued,
        customerId: customer.id,
        name: customer.name,
      });
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function resetAccess(customer: ShopCustomer) {
    if (!shopId) return;
    setError('');
    setInvitation(null);
    try {
      const issued = await api<{ token: string; expiresAt: string }>(
        `/shops/${shopId}/customers/${customer.id}/invite/reset`,
        { method: 'POST', body: {} },
      );
      setInvitation({
        ...issued,
        customerId: customer.id,
        name: customer.name,
      });
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
              Имя (необязательно)
              <input
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
                autoComplete="tel"
                pattern={KYRGYZ_PHONE_PATTERN}
                title="Номер Кыргызстана: +996 700 123 456"
                value={phone}
                onChange={(e) =>
                  setPhone(formatKyrgyzPhoneInput(e.target.value))
                }
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
        {invitation && (
          <BuyerActivationPanel
            name={invitation.name}
            token={invitation.token}
            expiresAt={invitation.expiresAt}
            shopId={shopId}
            customerId={invitation.customerId}
            onActivated={() => {
              setInvitation(null);
              setRevision((value) => value + 1);
            }}
            onClose={() => setInvitation(null)}
          />
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
                            <button
                              type="button"
                              className="button ghost"
                              style={{ fontSize: '13px', padding: '4px 8px' }}
                              onClick={() => void resetAccess(c)}
                              title="Выдать QR для сброса пароля и повторного входа"
                            >
                              Сбросить пароль (QR)
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void invite(c)}
                            >
                              Выдать код
                            </button>
                          )}
                        </td>
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
        Продажа в долг доступна и без подтверждённого кабинета. Для просмотра
        своих долгов и бонусов покупатель должен безопасно подтвердить личность.
      </p>
    </div>
  );
}
