import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';

type Application = {
  id: string;
  shop_name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  category: string;
  status: 'new' | 'in_review' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
};
type Product = {
  revision_id: string;
  variant_id: string;
  shop_name: string;
  name: string;
  description: string;
  category: string;
  has_photo: boolean;
  has_publication: boolean;
};
type Revision = Product & {
  approved_name: string | null;
  approved_description: string | null;
  approved_category: string | null;
  approved_has_photo: boolean;
  status: string;
};
type Audit = {
  kind: string;
  entity_id: string;
  status: string;
  reason: string | null;
  created_at: string;
};
type Page<T> = { items: T[]; total: number };

export default function AdminPage() {
  const session = useSession();
  const [applications, setApplications] = useState<Application[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [reason, setReason] = useState('');
  const [invitation, setInvitation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'applications' | 'products' | 'audit'>(
    'applications',
  );
  async function load() {
    const [a, p, h] = await Promise.all([
      api<Page<Application>>('/platform/admin/applications'),
      api<Page<Product>>('/platform/admin/products'),
      api<Page<Audit>>('/platform/admin/audit'),
    ]);
    setApplications(a.items);
    setProducts(p.items);
    setAudit(h.items);
    setLoading(false);
  }
  useEffect(() => {
    if (!session.user?.platformAdmin) return;
    void load().catch((e) => {
      setError(errorText(e));
      setLoading(false);
    });
  }, [session.user?.userId]);
  async function decideApplication(
    row: Application,
    decision: 'in_review' | 'approved' | 'rejected',
  ) {
    setError('');
    setInvitation('');
    setBusy(true);
    try {
      const result = await api<{ activationUrl?: string }>(
        `/platform/admin/applications/${row.id}/decision`,
        {
          method: 'POST',
          body: { expectedStatus: row.status, decision, reason },
        },
      );
      if (result.activationUrl)
        setInvitation(window.location.origin + result.activationUrl);
      setReason('');
      await load();
    } catch (e) {
      setError(errorText(e));
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function showProduct(id: string) {
    setError('');
    setReason('');
    try {
      setSelected(
        await api<Revision>(`/platform/admin/products/revisions/${id}`),
      );
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function decideProduct(decision: 'approved' | 'rejected') {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await api(
        `/platform/admin/products/revisions/${selected.revision_id}/decision`,
        {
          method: 'POST',
          body: { decision, reason },
        },
      );
      setSelected(null);
      setReason('');
      await load();
    } catch (e) {
      setError(errorText(e));
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  if (session.loading) return <p className="loading">Загрузка…</p>;
  if (!session.user)
    return (
      <Navigate
        to="/seller/login"
        replace
        state={{ from: '/platform/admin' }}
      />
    );
  if (!session.user.platformAdmin)
    return (
      <p role="alert" className="error">
        Нет доступа к кабинету платформы.
      </p>
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" to="/platform/admin">
          MyStore<span>Администрирование</span>
        </Link>
        <nav aria-label="Меню администратора">
          <button
            aria-current={tab === 'applications' ? 'page' : undefined}
            onClick={() => setTab('applications')}
          >
            Партнёры и заявки
          </button>
          <button
            aria-current={tab === 'products' ? 'page' : undefined}
            onClick={() => setTab('products')}
          >
            Модерация товаров
          </button>
          <button
            aria-current={tab === 'audit' ? 'page' : undefined}
            onClick={() => setTab('audit')}
          >
            Журнал решений
          </button>
          <Link to="/seller">Мои магазины</Link>
        </nav>
      </aside>
      <div className="admin-main">
        <main className="admin-workspace">
          <header>
            <div>
              <h1>Администрирование MyStore</h1>
              <p className="muted">
                Контроль партнёров, товаров и решений платформы
              </p>
            </div>
            <Link to="/seller">Мои магазины</Link>
            <button
              onClick={() =>
                void session
                  .logout()
                  .then(() => window.location.assign('/seller/login'))
                  .catch((e) => setError(errorText(e)))
              }
            >
              Выйти
            </button>
          </header>
          <div className="admin-overview-stats">
            <article className="panel">
              <small>Заявки партнёров</small>
              <h2>{applications.length}</h2>
            </article>
            <article className="panel">
              <small>Ожидают решения</small>
              <h2>
                {
                  applications.filter((a) =>
                    ['new', 'in_review'].includes(a.status),
                  ).length
                }
              </h2>
            </article>
            <article className="panel">
              <small>Карточки на модерации</small>
              <h2>{products.length}</h2>
            </article>
            <article className="panel">
              <small>Записи журнала</small>
              <h2>{audit.length}</h2>
            </article>
          </div>
          <nav aria-label="Разделы платформы" className="admin-tabs">
            <button
              aria-current={tab === 'applications' ? 'page' : undefined}
              onClick={() => setTab('applications')}
            >
              Заявки ({applications.length})
            </button>
            <button
              aria-current={tab === 'products' ? 'page' : undefined}
              onClick={() => setTab('products')}
            >
              Товары ({products.length})
            </button>
            <button
              aria-current={tab === 'audit' ? 'page' : undefined}
              onClick={() => setTab('audit')}
            >
              Журнал решений
            </button>
          </nav>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {invitation && (
            <div className="panel" role="status">
              <strong>Ссылка для владельца</strong>
              <p>
                Передайте её заявителю по проверенному контакту. Она
                показывается только сейчас и действует 7 дней.
              </p>
              <input
                aria-label="Ссылка активации"
                readOnly
                value={invitation}
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() =>
                  void navigator.clipboard
                    .writeText(invitation)
                    .catch((e) => setError(errorText(e)))
                }
              >
                Скопировать
              </button>
            </div>
          )}
          {loading ? (
            <p>Загрузка…</p>
          ) : tab === 'applications' ? (
            <section>
              <h2>Заявки партнёров</h2>
              {!applications.length && <p>Заявок пока нет.</p>}
              {applications.map((a) => (
                <article className="panel" key={a.id}>
                  <h3>
                    {a.shop_name} · {a.status}
                  </h3>
                  <p>
                    {a.city} · {a.category} · {a.address}
                  </p>
                  <p>
                    <a href={`mailto:${a.email}`}>{a.email}</a> ·{' '}
                    <a href={`tel:${a.phone}`}>{a.phone}</a>
                  </p>
                  {a.rejection_reason && (
                    <p>Причина отказа: {a.rejection_reason}</p>
                  )}
                  {['new', 'in_review'].includes(a.status) && (
                    <>
                      <label>
                        Причина отказа
                        <input
                          value={reason}
                          maxLength={500}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      {a.status === 'new' && (
                        <button
                          disabled={busy}
                          onClick={() => void decideApplication(a, 'in_review')}
                        >
                          Взять в работу
                        </button>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => void decideApplication(a, 'approved')}
                      >
                        Одобрить
                      </button>
                      <button
                        disabled={busy || !reason.trim()}
                        onClick={() => void decideApplication(a, 'rejected')}
                      >
                        Отклонить
                      </button>
                    </>
                  )}
                </article>
              ))}
            </section>
          ) : tab === 'products' ? (
            <section>
              <h2>Карточки на проверке</h2>
              {!products.length && <p>Нет карточек на проверке.</p>}
              {products.map((p) => (
                <article className="panel" key={p.revision_id}>
                  <h3>
                    {p.name} · {p.shop_name}
                  </h3>
                  <p>
                    {p.category} · {p.description}
                  </p>
                  <button onClick={() => void showProduct(p.revision_id)}>
                    Посмотреть изменения
                  </button>
                </article>
              ))}
              {selected && (
                <article className="panel">
                  <h3>Предложено: {selected.name}</h3>
                  {selected.has_photo && (
                    <img
                      className="product-photo"
                      src={`/api/platform/admin/products/revisions/${selected.revision_id}/photo`}
                      alt="Фото для проверки"
                    />
                  )}
                  <p>
                    {selected.category} · {selected.description}
                  </p>
                  <h3>
                    Сейчас на витрине:{' '}
                    {selected.approved_name ?? 'Ещё не опубликовано'}
                  </h3>
                  {selected.approved_has_photo && (
                    <img
                      className="product-photo"
                      src={`/api/platform/admin/products/revisions/${selected.revision_id}/photo?approved=true`}
                      alt="Одобренное фото"
                    />
                  )}
                  <p>
                    {selected.approved_category} ·{' '}
                    {selected.approved_description}
                  </p>
                  <label>
                    Причина отказа
                    <input
                      value={reason}
                      maxLength={500}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy}
                    onClick={() => void decideProduct('approved')}
                  >
                    Одобрить карточку
                  </button>
                  <button
                    disabled={busy || !reason.trim()}
                    onClick={() => void decideProduct('rejected')}
                  >
                    Отклонить карточку
                  </button>
                </article>
              )}
            </section>
          ) : (
            <section>
              <h2>Журнал решений</h2>
              {audit.map((a, i) => (
                <p className="panel" key={`${a.entity_id}-${i}`}>
                  {new Date(a.created_at).toLocaleString('ru-RU')} · {a.kind} ·{' '}
                  {a.status} · {a.reason ?? 'Без причины'}
                </p>
              ))}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
