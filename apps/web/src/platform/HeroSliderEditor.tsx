import { useState, useEffect, ChangeEvent } from 'react';
import { AdminCard, AdminStatus, AdminEmpty } from './AdminKit';

export type HeroSlide = {
  id?: string;
  sortOrder: number;
  isActive: boolean;
  badge: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  hideOverlay?: boolean;
  onlyImage?: boolean;
  bgGradient: string;
};

const GRADIENTS = [
  {
    key: 'blue',
    label: 'Синий океан',
    value: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
  },
  {
    key: 'indigo',
    label: 'Глубокий индиго',
    value: 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)',
  },
  {
    key: 'emerald',
    label: 'Изумруд',
    value: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)',
  },
  {
    key: 'amber',
    label: 'Тёплый янтарь',
    value: 'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)',
  },
  {
    key: 'rose',
    label: 'Малиновый',
    value: 'linear-gradient(135deg, #9f1239 0%, #f43f5e 100%)',
  },
  {
    key: 'purple',
    label: 'Фиолетовый',
    value: 'linear-gradient(135deg, #581c87 0%, #9333ea 100%)',
  },
];

const PRESET_BANNERS = [
  { label: '«Товары рядом»', url: '/banners/banner-shops.jpg' },
  { label: '«Скидки до 50%»', url: '/banners/banner-sale.jpg' },
  { label: '«Быстрая доставка»', url: '/banners/banner-delivery.jpg' },
];

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    sortOrder: 0,
    isActive: true,
    badge: 'МАРКЕТПЛЕЙС МАГАЗИНОВ',
    title: 'Товары рядом',
    subtitle: 'Смотрите наличие и забирайте в магазине',
    buttonText: 'Смотреть товары',
    buttonUrl: '#catalog',
    imageUrl: '/banners/banner-shops.jpg',
    mobileImageUrl: null,
    hideOverlay: false,
    onlyImage: false,
    bgGradient: 'blue',
  },
  {
    sortOrder: 1,
    isActive: true,
    badge: 'СКИДКИ И АКЦИИ',
    title: 'Скидки до 50%',
    subtitle: 'Сезонные предложения от магазинов вашего города',
    buttonText: 'Смотреть скидки',
    buttonUrl: '#catalog',
    imageUrl: '/banners/banner-sale.jpg',
    mobileImageUrl: null,
    hideOverlay: false,
    onlyImage: false,
    bgGradient: 'indigo',
  },
  {
    sortOrder: 2,
    isActive: true,
    badge: 'БЫСТРАЯ ВЫДАЧА',
    title: 'Быстрая доставка',
    subtitle: 'Забирайте сами или закажите курьером прямо до двери',
    buttonText: 'Магазины рядом',
    buttonUrl: '/shops',
    imageUrl: '/banners/banner-delivery.jpg',
    mobileImageUrl: null,
    hideOverlay: false,
    onlyImage: false,
    bgGradient: 'emerald',
  },
];

async function processBannerImage(
  file: File,
  isMobile = false,
): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Прикрепите изображение JPEG, PNG или WebP.');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Размер изображения не должен превышать 20 МБ.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.onload = () => {
      if (typeof window === 'undefined' || typeof Image === 'undefined') {
        return resolve(String(reader.result));
      }
      const img = new Image();
      img.onerror = () =>
        reject(new Error('Не удалось обработать изображение.'));
      img.onload = () => {
        try {
          const maxW = isMobile ? 800 : 1200;
          const maxH = isMobile ? 800 : 550;
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const scale = Math.min(maxW / w, maxH / h);
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(String(reader.result));
          }
          ctx.drawImage(img, 0, 0, w, h);
          let compressed = canvas.toDataURL('image/jpeg', 0.8);
          if (compressed.length > 1800000) {
            const downscaled = document.createElement('canvas');
            downscaled.width = Math.round(w * 0.7);
            downscaled.height = Math.round(h * 0.7);
            const dCtx = downscaled.getContext('2d');
            if (dCtx) {
              dCtx.drawImage(canvas, 0, 0, downscaled.width, downscaled.height);
              compressed = downscaled.toDataURL('image/jpeg', 0.7);
            }
          }
          resolve(compressed);
        } catch {
          resolve(String(reader.result));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function HeroSliderEditor({
  initialSlides,
  onSave,
  saving,
}: {
  initialSlides: HeroSlide[];
  onSave: (slides: HeroSlide[]) => Promise<void>;
  saving?: boolean;
}) {
  const [slides, setSlides] = useState<HeroSlide[]>(() =>
    initialSlides.length ? initialSlides : DEFAULT_SLIDES,
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (initialSlides.length && !dirty) {
      setSlides(initialSlides);
    }
  }, [initialSlides, dirty]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>(
    'desktop',
  );

  const updateSlide = (index: number, patch: Partial<HeroSlide>) => {
    setSlides((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    setDirty(true);
    setSaved(false);
    setError('');
  };

  const addSlide = () => {
    setSlides((prev) => [
      ...prev,
      {
        sortOrder: prev.length,
        isActive: true,
        badge: 'АКЦИЯ',
        title: 'Новый промо-баннер',
        subtitle: 'Описание специального предложения для покупателей',
        buttonText: 'Подробнее',
        buttonUrl: '#catalog',
        imageUrl: null,
        mobileImageUrl: null,
        hideOverlay: false,
        onlyImage: false,
        bgGradient: 'indigo',
      },
    ]);
    setDirty(true);
    setSaved(false);
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 1) {
      setError('В слайдере должен оставаться хотя бы один слайд.');
      return;
    }
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
    setSaved(false);
    if (previewIdx >= slides.length - 1) {
      setPreviewIdx(Math.max(0, slides.length - 2));
    }
  };

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy.map((item, idx) => ({ ...item, sortOrder: idx }));
    });
    setDirty(true);
    setSaved(false);
  };

  const resetToDefaults = () => {
    setSlides(DEFAULT_SLIDES);
    setDirty(true);
    setSaved(false);
    setError('');
    setPreviewIdx(0);
  };

  const handleFileUpload = async (
    index: number,
    e: ChangeEvent<HTMLInputElement>,
    target: 'desktop' | 'mobile' = 'desktop',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError('');
      const dataUrl = await processBannerImage(file, target === 'mobile');
      if (target === 'mobile') {
        updateSlide(index, { mobileImageUrl: dataUrl });
      } else {
        updateSlide(index, { imageUrl: dataUrl });
      }
    } catch (err: any) {
      setError(err?.message || 'Не удалось загрузить файл.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    for (let i = 0; i < slides.length; i++) {
      if (!slides[i].title.trim()) {
        setError(`Слайд #${i + 1}: заголовок обязателен для заполнения.`);
        return;
      }
    }
    try {
      setError('');
      await onSave(
        slides.map((s, idx) => ({
          ...s,
          sortOrder: idx,
          badge: s.badge.trim(),
          title: s.title.trim(),
          subtitle: s.subtitle.trim(),
          buttonText: s.buttonText.trim(),
          buttonUrl: s.buttonUrl.trim(),
          imageUrl: s.imageUrl?.trim() || null,
          mobileImageUrl: s.mobileImageUrl?.trim() || null,
          hideOverlay: Boolean(s.hideOverlay),
          onlyImage: Boolean(s.onlyImage),
        })),
      );
      setDirty(false);
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить слайды.');
    }
  };

  const activeSlide = slides[previewIdx] || slides[0];
  const activeGradient =
    GRADIENTS.find((g) => g.key === activeSlide?.bgGradient)?.value ||
    GRADIENTS[0].value;
  const previewImage =
    previewDevice === 'mobile'
      ? activeSlide?.mobileImageUrl || activeSlide?.imageUrl
      : activeSlide?.imageUrl;
  const previewBg = previewImage
    ? activeSlide?.hideOverlay
      ? `url(${previewImage}) center/cover no-repeat`
      : `linear-gradient(rgba(15,23,42,0.65), rgba(15,23,42,0.65)), url(${previewImage}) center/cover no-repeat`
    : activeGradient;

  return (
    <div className="page-stack">
      {/* Live Preview Card */}
      <AdminCard
        title="Предпросмотр слайдера на витрине"
        subtitle="Так баннер будет отображаться на главной странице маркетплейса"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={previewDevice === 'desktop' ? 'primary' : 'secondary'}
              style={{ fontSize: '12px', padding: '5px 12px' }}
              onClick={() => setPreviewDevice('desktop')}
            >
              🖥️ ПК / Десктоп
            </button>
            <button
              type="button"
              className={previewDevice === 'mobile' ? 'primary' : 'secondary'}
              style={{ fontSize: '12px', padding: '5px 12px' }}
              onClick={() => setPreviewDevice('mobile')}
            >
              📱 Смартфон (мобильный вид)
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeSlide?.hideOverlay && (
              <span
                style={{
                  fontSize: '11.5px',
                  color: '#0284c7',
                  background: '#e0f2fe',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                Без затемнения
              </span>
            )}
            {activeSlide?.onlyImage && (
              <span
                style={{
                  fontSize: '11.5px',
                  color: '#7c3aed',
                  background: '#f3e8ff',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                Только фото
              </span>
            )}
          </div>
        </div>

        <div
          className="admin-slider-preview-wrap"
          style={{
            background: previewBg,
            borderRadius: '20px',
            padding: previewDevice === 'mobile' ? '22px 18px' : '36px 32px',
            maxWidth: previewDevice === 'mobile' ? '360px' : '100%',
            margin: previewDevice === 'mobile' ? '0 auto' : undefined,
            color: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
            minHeight: previewDevice === 'mobile' ? '180px' : '200px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'max-width 0.2s ease',
          }}
        >
          {activeSlide?.onlyImage ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: previewDevice === 'mobile' ? '140px' : '160px',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                <span
                  style={{
                    background: 'rgba(15,23,42,0.65)',
                    backdropFilter: 'blur(6px)',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  Только баннер (текст скрыт)
                </span>
                {!activeSlide?.isActive && (
                  <AdminStatus tone="neutral">Скрыт на витрине</AdminStatus>
                )}
              </div>
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: 'rgba(255,255,255,0.92)',
                  color: '#0f172a',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                Ссылка клика: {activeSlide.buttonUrl || '#catalog'}
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
              >
                {activeSlide?.badge && (
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.22)',
                      backdropFilter: 'blur(6px)',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                    }}
                  >
                    {activeSlide.badge}
                  </span>
                )}
                {!activeSlide?.isActive && (
                  <AdminStatus tone="neutral">Скрыт на витрине</AdminStatus>
                )}
              </div>
              <h2
                style={{
                  color: '#ffffff',
                  fontSize: previewDevice === 'mobile' ? '22px' : '28px',
                  fontWeight: 850,
                  marginTop: '12px',
                  marginBottom: '8px',
                  lineHeight: 1.2,
                }}
              >
                {activeSlide?.title || 'Заголовок слайда'}
              </h2>
              <p
                style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: previewDevice === 'mobile' ? '13px' : '14.5px',
                  margin: 0,
                  maxWidth: '520px',
                }}
              >
                {activeSlide?.subtitle ||
                  'Подзаголовок или описание предложения'}
              </p>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: activeSlide?.onlyImage
                ? 'flex-end'
                : 'space-between',
              marginTop: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {!activeSlide?.onlyImage && (
              <span
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  padding:
                    previewDevice === 'mobile' ? '8px 16px' : '10px 20px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: previewDevice === 'mobile' ? '13px' : '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {activeSlide?.buttonText || 'Смотреть'} →
              </span>
            )}

            {/* Navigation Dots */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() =>
                  setPreviewIdx((i) => (i <= 0 ? slides.length - 1 : i - 1))
                }
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  border: 0,
                  color: '#fff',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
                aria-label="Предыдущий слайд"
              >
                ‹
              </button>
              {slides.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => setPreviewIdx(dotIdx)}
                  style={{
                    width: previewIdx === dotIdx ? '24px' : '8px',
                    height: '8px',
                    borderRadius: '4px',
                    border: 0,
                    background:
                      previewIdx === dotIdx
                        ? '#ffffff'
                        : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    padding: 0,
                  }}
                  aria-label={`Слайд ${dotIdx + 1}`}
                />
              ))}
              <button
                type="button"
                onClick={() =>
                  setPreviewIdx((i) => (i >= slides.length - 1 ? 0 : i + 1))
                }
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  border: 0,
                  color: '#fff',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
                aria-label="Следующий слайд"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </AdminCard>

      {/* Slides Editor List */}
      <AdminCard
        title="Слайды главного экрана"
        subtitle="Настройте промо-баннеры, которые отображаются в карусели на главной странице"
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="secondary"
              onClick={resetToDefaults}
              title="Восстановить 3 стандартных баннера с готовыми изображениями"
            >
              ↺ Стандартные баннеры
            </button>
            <button type="button" className="primary" onClick={addSlide}>
              + Добавить слайд
            </button>
          </div>
        }
      >
        {error && (
          <p role="alert" className="error" style={{ marginBottom: 16 }}>
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="success" style={{ marginBottom: 16 }}>
            Слайдер успешно сохранён и опубликован на главной витрине.
          </p>
        )}

        {!slides.length ? (
          <AdminEmpty>Нет слайдов. Добавьте первый промо-слайд.</AdminEmpty>
        ) : (
          <div className="page-stack">
            {slides.map((s, index) => (
              <div
                key={s.id || index}
                className="panel form-panel"
                style={{
                  border:
                    previewIdx === index
                      ? '2px solid var(--admin-accent, #10b981)'
                      : '1px solid var(--admin-border, #e2e8f0)',
                  borderRadius: '16px',
                  padding: '20px',
                  background: 'var(--admin-surface, #ffffff)',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>Слайд #{index + 1}</strong>
                    <label
                      className="checkbox-label"
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={s.isActive}
                        onChange={(e) =>
                          updateSlide(index, { isActive: e.target.checked })
                        }
                      />
                      <span>Активен</span>
                    </label>
                    <label
                      className="checkbox-label"
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(s.hideOverlay)}
                        onChange={(e) =>
                          updateSlide(index, { hideOverlay: e.target.checked })
                        }
                      />
                      <span>Без затемнения</span>
                    </label>
                    <label
                      className="checkbox-label"
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(s.onlyImage)}
                        onChange={(e) =>
                          updateSlide(index, { onlyImage: e.target.checked })
                        }
                      />
                      <span>Только фото (скрыть текст поверх)</span>
                    </label>
                  </div>

                  <div
                    className="actions"
                    style={{ display: 'flex', gap: '6px' }}
                  >
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveSlide(index, 'up')}
                      title="Поднять выше"
                    >
                      ↑ Вверх
                    </button>
                    <button
                      type="button"
                      disabled={index === slides.length - 1}
                      onClick={() => moveSlide(index, 'down')}
                      title="Опустить ниже"
                    >
                      ↓ Вниз
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewIdx(index)}
                      className={previewIdx === index ? 'primary' : ''}
                    >
                      {previewIdx === index
                        ? 'В предпросмотре'
                        : 'Предпросмотр'}
                    </button>
                    <button
                      type="button"
                      className="admin-kit-reject"
                      onClick={() => removeSlide(index)}
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                    gap: '16px',
                  }}
                >
                  <label>
                    Бейдж / Тег
                    <input
                      value={s.badge}
                      placeholder="Например: МАРКЕТПЛЕЙС или АКЦИЯ"
                      maxLength={50}
                      onChange={(e) =>
                        updateSlide(index, { badge: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Заголовок *
                    <input
                      value={s.title}
                      placeholder="Заголовок промо-блока"
                      maxLength={120}
                      required
                      onChange={(e) =>
                        updateSlide(index, { title: e.target.value })
                      }
                    />
                  </label>

                  <label style={{ gridColumn: '1 / -1' }}>
                    Подзаголовок / Описание
                    <textarea
                      rows={2}
                      value={s.subtitle}
                      placeholder="Короткое описание или призыв к действию"
                      maxLength={250}
                      onChange={(e) =>
                        updateSlide(index, { subtitle: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Текст кнопки
                    <input
                      value={s.buttonText}
                      placeholder="Например: Смотреть товары"
                      maxLength={50}
                      onChange={(e) =>
                        updateSlide(index, { buttonText: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Ссылка кнопки
                    <input
                      value={s.buttonUrl}
                      placeholder="Например: #catalog или /shops"
                      maxLength={255}
                      onChange={(e) =>
                        updateSlide(index, { buttonUrl: e.target.value })
                      }
                    />
                  </label>

                  <label>
                    Цветовая гамма фона
                    <select
                      value={s.bgGradient}
                      onChange={(e) =>
                        updateSlide(index, { bgGradient: e.target.value })
                      }
                    >
                      {GRADIENTS.map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div
                    style={{
                      gridColumn: '1 / -1',
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                      gap: '16px',
                      marginTop: '8px',
                      paddingTop: '16px',
                      borderTop: '1px solid #e2e8f0',
                    }}
                  >
                    {/* Desktop Banner Box */}
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '13px',
                          color: '#0f172a',
                          marginBottom: '8px',
                        }}
                      >
                        🖥️ Основной баннер (ПК и планшеты)
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap',
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            width: '100%',
                          }}
                        >
                          Быстрый выбор готового баннера:
                        </span>
                        {PRESET_BANNERS.map((pb) => (
                          <button
                            key={pb.url}
                            type="button"
                            className="secondary"
                            style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              background:
                                s.imageUrl === pb.url ? '#e0f2fe' : undefined,
                              borderColor:
                                s.imageUrl === pb.url ? '#0284c7' : undefined,
                            }}
                            onClick={() =>
                              updateSlide(index, { imageUrl: pb.url })
                            }
                          >
                            {pb.label}
                          </button>
                        ))}
                      </div>
                      <label style={{ display: 'grid', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          URL баннера:
                        </span>
                        <input
                          type="text"
                          placeholder="/banners/... или https://..."
                          value={s.imageUrl || ''}
                          onChange={(e) =>
                            updateSlide(index, {
                              imageUrl: e.target.value.trim() || null,
                            })
                          }
                        />
                      </label>
                      <label
                        style={{
                          display: 'grid',
                          gap: '4px',
                          marginTop: '8px',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          Или загрузите файл для ПК (автосжатие):
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          aria-label="Загрузить баннер для ПК"
                          onChange={(e) =>
                            handleFileUpload(index, e, 'desktop')
                          }
                        />
                      </label>
                      {s.imageUrl && (
                        <div
                          style={{
                            marginTop: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                          }}
                        >
                          <img
                            src={s.imageUrl}
                            alt="Миниатюра ПК"
                            style={{
                              width: '80px',
                              height: '46px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateSlide(index, { imageUrl: null })
                            }
                          >
                            Убрать фото
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Mobile Banner Box */}
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '13px',
                          color: '#0f172a',
                          marginBottom: '4px',
                        }}
                      >
                        📱 Мобильный баннер (для смартфонов)
                      </div>
                      <p
                        style={{
                          fontSize: '11.5px',
                          color: '#64748b',
                          margin: '0 0 10px',
                          lineHeight: 1.4,
                        }}
                      >
                        Отображается на смартфонах вместо основного. Если не
                        задан, используется баннер для ПК.
                      </p>
                      <label style={{ display: 'grid', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          URL мобильного баннера:
                        </span>
                        <input
                          type="text"
                          placeholder="URL мобильного фото (https://...)"
                          value={s.mobileImageUrl || ''}
                          onChange={(e) =>
                            updateSlide(index, {
                              mobileImageUrl: e.target.value.trim() || null,
                            })
                          }
                        />
                      </label>
                      <label
                        style={{
                          display: 'grid',
                          gap: '4px',
                          marginTop: '8px',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          Или загрузите файл для смартфонов (квадратный или
                          вертикальный):
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          aria-label="Загрузить баннер для смартфонов"
                          onChange={(e) => handleFileUpload(index, e, 'mobile')}
                        />
                      </label>
                      {s.mobileImageUrl && (
                        <div
                          style={{
                            marginTop: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                          }}
                        >
                          <img
                            src={s.mobileImageUrl}
                            alt="Миниатюра мобайл"
                            style={{
                              width: '50px',
                              height: '50px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateSlide(index, { mobileImageUrl: null })
                            }
                          >
                            Убрать мобильное фото
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className="actions"
          style={{
            marginTop: '24px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="primary"
            disabled={saving || !dirty}
            onClick={handleSave}
          >
            {saving ? 'Сохранение…' : 'Сохранить изменения'}
          </button>
          {dirty && <span className="muted">Есть несохранённые изменения</span>}
        </div>
      </AdminCard>
    </div>
  );
}
