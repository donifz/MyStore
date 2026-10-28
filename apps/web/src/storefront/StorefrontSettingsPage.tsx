import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { StoreProfile, StorefrontBanner } from './types';
import { useResource } from './use-resource';
import BusinessHoursEditor from './BusinessHoursEditor';
import BannerEditor from './BannerEditor';
export default function StorefrontSettingsPage() {
  const { shopId } = useParams(),
    session = useSession();
  const owner =
    session.user?.shops.find((s) => s.id === shopId)?.role === 'owner';
  const resource = useResource<StoreProfile>(
    owner ? `/shops/${shopId}/storefront` : null,
  );
  const [form, setForm] = useState<StoreProfile | null>(null),
    [bannerDraft, setBannerDraft] = useState<StorefrontBanner | null>(null),
    [busy, setBusy] = useState(false),
    [bannerBusy, setBannerBusy] = useState(false),
    [bannerDirty, setBannerDirty] = useState(false),
    [bannerError, setBannerError] = useState(''),
    [bannerSaved, setBannerSaved] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    setForm(resource.data);
    setBannerDraft(resource.data?.banner ?? null);
    setBannerDirty(false);
    setBannerSaved(false);
    setSaved(false);
    setDirty(false);
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
  function field<K extends keyof StoreProfile>(k: K, value: StoreProfile[K]) {
    setForm((f) => (f ? { ...f, [k]: value } : f));
    setSaved(false);
    setDirty(true);
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
        timeZone,
        businessSchedule,
        slug,
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
            timeZone: timeZone ?? 'Asia/Bishkek',
            businessSchedule: businessSchedule ?? null,
            slug,
          },
        }),
      );
      setSaved(true);
      setDirty(false);
    } catch (e) {
      setError(
        e instanceof ApiError && [400, 409].includes(e.status)
          ? e.message
          : errorText(e),
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveBanner() {
    if (!form) return;
    setBannerBusy(true);
    setBannerError('');
    setBannerSaved(false);
    try {
      const result = await api<{ banner: StorefrontBanner | null }>(
        `/shops/${shopId}/storefront/banner`,
        { method: 'PUT', body: { banner: bannerDraft } },
      );
      setBannerDraft(result.banner);
      setBannerDirty(false);
      setBannerSaved(true);
      setForm((current) =>
        current ? { ...current, banner: result.banner } : current,
      );
    } catch (e) {
      setBannerError(
        e instanceof ApiError && e.status === 400
          ? 'Не удалось сохранить изображение. Проверьте формат и размер файла.'
          : errorText(e),
      );
    } finally {
      setBannerBusy(false);
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
          <a className="button" href={'/shop/' + form.slug}>
            Открыть витрину ↗
          </a>
        )}
      </div>
      <section className="panel form-panel">
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <div>
              <label htmlFor="storefront-slug">Адрес витрины</label>
              <input
                id="storefront-slug"
                required
                minLength={3}
                maxLength={40}
                pattern="[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])"
                value={form.slug}
                onChange={(e) => field('slug', e.target.value.toLowerCase())}
              />
              <small className="muted storefront-slug-preview">
                Публичный адрес:{' '}
                <strong className="code">/shop/{form.slug}</strong>
              </small>
            </div>
            <label>
              Описание магазина
              <textarea
                maxLength={2000}
                rows={4}
                value={form.description}
                onChange={(e) => field('description', e.target.value)}
              />
            </label>
            <BannerEditor
              value={bannerDraft}
              disabled={busy}
              saving={bannerBusy}
              dirty={bannerDirty}
              saved={bannerSaved}
              error={bannerError}
              onChange={(value) => {
                setBannerDraft(value);
                setBannerDirty(true);
                setBannerSaved(false);
                setBannerError('');
              }}
              onSave={() => void saveBanner()}
            />
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
            {!form.businessSchedule && (
              <label>
                Часы работы (описание)
                <input
                  maxLength={1000}
                  value={form.hours}
                  placeholder="Пн–Сб, 10:00–19:00"
                  onChange={(e) => field('hours', e.target.value)}
                />
              </label>
            )}
            <BusinessHoursEditor
              value={form.businessSchedule ?? null}
              timeZone={form.timeZone ?? 'Asia/Bishkek'}
              disabled={busy}
              onChange={(value) => field('businessSchedule', value)}
              onTimeZoneChange={(value) => field('timeZone', value)}
            />
            {dirty ? (
              <p className="muted">
                Сохраните изменения, чтобы обновить пример срока.
              </p>
            ) : (
              form.confirmationPreview && (
                <p className="business-hours-preview">
                  Если заказ поступит сейчас, подтвердить его нужно до{' '}
                  <strong>
                    {new Intl.DateTimeFormat('ru-RU', {
                      timeZone: form.timeZone ?? 'Asia/Bishkek',
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(form.confirmationPreview.expiresAt))}
                  </strong>{' '}
                  ({form.timeZone ?? 'Asia/Bishkek'}).
                  <small className="muted">
                    Пример рассчитан при последнем сохранении или загрузке
                    настроек.
                  </small>
                </p>
              )
            )}
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
