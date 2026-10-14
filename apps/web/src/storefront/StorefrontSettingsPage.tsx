import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { StoreProfile } from './types';
import { useResource } from './use-resource';
export default function StorefrontSettingsPage() {
  const { shopId } = useParams(),
    session = useSession();
  const owner =
    session.user?.shops.find((s) => s.id === shopId)?.role === 'owner';
  const resource = useResource<StoreProfile>(
    owner ? `/shops/${shopId}/storefront` : null,
  );
  const [form, setForm] = useState<StoreProfile | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setForm(resource.data);
    setSaved(false);
  }, [resource.data]);
  if (!owner) return <p role="alert">Настройка витрины доступна владельцу.</p>;
  if (!form)
    return (
      <p
        role={resource.error ? 'alert' : 'status'}
        className={resource.error ? 'error' : 'loading'}
      >
        {resource.error || 'Загрузка настроек…'}
      </p>
    );
  function field(k: keyof StoreProfile, value: string | boolean) {
    setForm((f) => (f ? { ...f, [k]: value } : f));
    setSaved(false);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError('');
    try {
      const {
        description,
        city,
        address,
        phone,
        hours,
        published,
        district,
        pickupEnabled,
        deliveryEnabled,
      } = form;
      setForm(
        await api<StoreProfile>(`/shops/${shopId}/storefront`, {
          method: 'PUT',
          body: {
            description,
            city,
            address,
            phone,
            hours,
            published,
            district,
            pickupEnabled,
            deliveryEnabled,
          },
        }),
      );
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Публичный магазин</p>
          <h1>Витрина</h1>
          <p className="muted">Контакты и каталог для покупателей</p>
        </div>
        {form.published && (
          <a className="button" href={'/shops/' + form.slug}>
            Открыть витрину ↗
          </a>
        )}
      </div>
      <section className="panel form-panel">
        <p>
          Адрес витрины: <strong className="code">/shops/{form.slug}</strong>
        </p>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              Описание магазина
              <textarea
                maxLength={2000}
                rows={4}
                value={form.description}
                onChange={(e) => field('description', e.target.value)}
              />
            </label>
            <label>
              Город
              <input
                required={form.published}
                maxLength={80}
                value={form.city}
                onChange={(e) => field('city', e.target.value)}
              />
            </label>
            <label>
              Район
              <input
                maxLength={80}
                value={form.district || ''}
                onChange={(e) => field('district', e.target.value)}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.pickupEnabled ?? true}
                onChange={(e) => field('pickupEnabled', e.target.checked)}
              />
              Самовывоз из магазина
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.deliveryEnabled ?? false}
                onChange={(e) => field('deliveryEnabled', e.target.checked)}
              />
              Доставка по согласованию с покупателем
            </label>
            <label>
              Адрес
              <input
                maxLength={250}
                value={form.address}
                onChange={(e) => field('address', e.target.value)}
              />
            </label>
            <label>
              Телефон для покупателей
              <input
                type="tel"
                required={form.published}
                maxLength={30}
                placeholder="+996 …"
                value={form.phone}
                onChange={(e) => field('phone', e.target.value)}
              />
            </label>
            <label>
              Часы работы
              <input
                maxLength={120}
                value={form.hours}
                placeholder="Пн–Сб, 10:00–19:00"
                onChange={(e) => field('hours', e.target.value)}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => field('published', e.target.checked)}
              />
              Опубликовать магазин
            </label>
            <p className="notice">
              После публикации покупатели увидят ваш каталог, город и указанные
              контакты. Новые карточки появляются после одобрения
              администратором платформы. Публикацию каждого товара можно
              отключить в его настройках.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="success" role="status">
                Настройки витрины сохранены.
              </p>
            )}
            <button className="primary">
              {busy ? 'Сохранение…' : 'Сохранить витрину'}
            </button>
          </fieldset>
        </form>
      </section>
    </>
  );
}
