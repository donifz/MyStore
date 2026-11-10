import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { StoreProfile, StorefrontBanner } from './types';
import { ShopCustomAttribute, CustomAttributeType } from '../api/types';
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
    [dirty, setDirty] = useState(false),
    [customAttrs, setCustomAttrs] = useState<ShopCustomAttribute[]>([]),
    [newAttrName, setNewAttrName] = useState(''),
    [newAttrType, setNewAttrType] = useState<CustomAttributeType>('select'),
    [newAttrOptions, setNewAttrOptions] = useState(''),
    [attrBusy, setAttrBusy] = useState(false),
    [attrError, setAttrError] = useState(''),
    [attrSuccess, setAttrSuccess] = useState('');
  useEffect(() => {
    setForm(resource.data);
    setBannerDraft(resource.data?.banner ?? null);
    setBannerDirty(false);
    setBannerSaved(false);
    setSaved(false);
    setDirty(false);
  }, [resource.data]);
  useEffect(() => {
    if (owner && shopId) {
      void api<ShopCustomAttribute[]>(`/shops/${shopId}/custom-attributes`)
        .then((items) => setCustomAttrs(items || []))
        .catch(() => {});
    }
  }, [owner, shopId]);
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
          <fieldset disabled={busy} className="form-grid">
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
            <label className="form-grid-full">
              Описание магазина
              <textarea
                maxLength={2000}
                rows={4}
                value={form.description}
                onChange={(e) => field('description', e.target.value)}
              />
            </label>
            <div className="form-grid-full">
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
            </div>
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
            <label className="form-grid-full">
              Адрес
              <input
                maxLength={250}
                value={form.address}
                onChange={(e) => field('address', e.target.value)}
              />
            </label>
            <div className="actions form-grid-full">
              <label className="checkbox checkbox-label">
                <input
                  type="checkbox"
                  checked={form.pickupEnabled ?? true}
                  onChange={(e) => field('pickupEnabled', e.target.checked)}
                />
                Самовывоз из магазина
              </label>
              <label className="checkbox checkbox-label">
                <input
                  type="checkbox"
                  checked={form.deliveryEnabled ?? false}
                  onChange={(e) => field('deliveryEnabled', e.target.checked)}
                />
                Доставка по согласованию с покупателем
              </label>
            </div>
            {!form.businessSchedule && (
              <label className="form-grid-full">
                Часы работы (описание)
                <input
                  maxLength={1000}
                  value={form.hours}
                  placeholder="Пн–Сб, 10:00–19:00"
                  onChange={(e) => field('hours', e.target.value)}
                />
              </label>
            )}
            <div className="form-grid-full">
              <BusinessHoursEditor
                value={form.businessSchedule ?? null}
                timeZone={form.timeZone ?? 'Asia/Bishkek'}
                disabled={busy}
                onChange={(value) => field('businessSchedule', value)}
                onTimeZoneChange={(value) => field('timeZone', value)}
              />
            </div>
            {dirty ? (
              <p className="muted form-grid-full">
                Сохраните изменения, чтобы обновить пример срока.
              </p>
            ) : (
              form.confirmationPreview && (
                <p className="business-hours-preview form-grid-full">
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
            <label className="checkbox checkbox-label form-grid-full">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => field('published', e.target.checked)}
              />
              Опубликовать магазин
            </label>
            <p className="notice form-grid-full">
              После публикации покупатели увидят ваш каталог, город и указанные
              контакты. Новые карточки появляются после одобрения
              администратором платформы. Публикацию каждого товара можно
              отключить в его настройках.
            </p>
            {error && (
              <p className="error form-grid-full" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="success form-grid-full" role="status">
                Настройки витрины сохранены.
              </p>
            )}
            <div className="actions form-grid-full">
              <button className="primary">
                {busy ? 'Сохранение…' : 'Сохранить витрину'}
              </button>
            </div>
          </fieldset>
        </form>
      </section>

      <section className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>Свойства товаров и фильтры витрины</h2>
        <p className="muted">
          Добавьте свойства магазина (например, Бренд, Возраст, Материал). Они
          будут доступны в дополнительных полях при создании товаров и
          отобразятся в фильтрах каталога вашей витрины.
        </p>

        {attrError && (
          <p role="alert" className="error">
            {attrError}
          </p>
        )}
        {attrSuccess && (
          <p role="status" className="success">
            {attrSuccess}
          </p>
        )}

        {customAttrs.length > 0 ? (
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Ключ</th>
                  <th>Тип</th>
                  <th>Варианты</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {customAttrs.map((attr) => (
                  <tr key={attr.id}>
                    <td>
                      <strong>{attr.name}</strong>
                    </td>
                    <td>
                      <code>{attr.key}</code>
                    </td>
                    <td>
                      {attr.type === 'select'
                        ? 'Выпадающий список'
                        : attr.type === 'number'
                          ? 'Число'
                          : 'Текст'}
                    </td>
                    <td>
                      {attr.type === 'select' ? attr.options.join(', ') : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="danger"
                        disabled={attrBusy}
                        onClick={() =>
                          void handleDeleteAttr(attr.id, attr.name)
                        }
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.8rem',
                        }}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Пока нет дополнительных свойств. Добавьте первое свойство ниже.
          </p>
        )}

        <form
          onSubmit={(e) => void handleAddAttr(e)}
          style={{
            marginTop: '1.25rem',
            padding: '1rem',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '8px',
            background: 'var(--surface-subtle, #f8fafc)',
          }}
        >
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>
            + Добавить свойство товара
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <label>
              Название свойства
              <input
                required
                maxLength={80}
                value={newAttrName}
                onChange={(e) => setNewAttrName(e.target.value)}
                placeholder="Например, Бренд или Возраст"
              />
            </label>
            <label>
              Тип свойства
              <select
                value={newAttrType}
                onChange={(e) =>
                  setNewAttrType(e.target.value as CustomAttributeType)
                }
              >
                <option value="select">Список вариантов (select)</option>
                <option value="number">Число (number)</option>
                <option value="string">Текст (string)</option>
              </select>
            </label>
            {newAttrType === 'select' && (
              <label style={{ gridColumn: '1 / -1' }}>
                Варианты через запятую
                <input
                  value={newAttrOptions}
                  onChange={(e) => setNewAttrOptions(e.target.value)}
                  placeholder="Например: LEGO, Barbie, Hot Wheels"
                />
              </label>
            )}
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="submit"
              className="primary"
              disabled={attrBusy || !newAttrName.trim()}
            >
              {attrBusy ? 'Сохранение…' : 'Добавить свойство'}
            </button>
          </div>
        </form>
      </section>
    </>
  );

  async function handleAddAttr(e: FormEvent) {
    e.preventDefault();
    if (!shopId) return;
    const name = newAttrName.trim();
    if (!name) {
      setAttrError('Укажите название свойства');
      return;
    }
    setAttrBusy(true);
    setAttrError('');
    setAttrSuccess('');
    try {
      const options =
        newAttrType === 'select'
          ? newAttrOptions
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      if (newAttrType === 'select' && options.length === 0) {
        throw new Error('Укажите хотя бы один вариант через запятую');
      }
      const created = await api<ShopCustomAttribute>(
        `/shops/${shopId}/custom-attributes`,
        {
          method: 'POST',
          body: {
            name,
            type: newAttrType,
            options,
            filterable: true,
          },
        },
      );
      setCustomAttrs((prev) => [...prev, created]);
      setNewAttrName('');
      setNewAttrOptions('');
      setAttrSuccess(`Свойство «${created.name}» успешно добавлено.`);
    } catch (err) {
      setAttrError(errorText(err));
    } finally {
      setAttrBusy(false);
    }
  }

  async function handleDeleteAttr(id: string, name: string) {
    if (!shopId) return;
    if (!window.confirm(`Удалить свойство «${name}»?`)) return;
    setAttrBusy(true);
    setAttrError('');
    setAttrSuccess('');
    try {
      await api(`/shops/${shopId}/custom-attributes/${id}`, {
        method: 'DELETE',
      });
      setCustomAttrs((prev) => prev.filter((a) => a.id !== id));
      setAttrSuccess(`Свойство «${name}» удалено.`);
    } catch (err) {
      setAttrError(errorText(err));
    } finally {
      setAttrBusy(false);
    }
  }
}
