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

async function processBannerImage(file: File): Promise<string> {
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
          const maxW = 1400;
          const maxH = 650;
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
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
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
    initialSlides.length
      ? initialSlides
      : [
          {
            sortOrder: 0,
            isActive: true,
            badge: 'МАРКЕТПЛЕЙС МАГАЗИНОВ',
            title: 'Товары рядом',
            subtitle: 'Смотрите наличие и забирайте в магазине',
            buttonText: 'Смотреть товары',
            buttonUrl: '#catalog',
            imageUrl: null,
            bgGradient: 'blue',
          },
        ],
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

  const handleFileUpload = async (
    index: number,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError('');
      const dataUrl = await processBannerImage(file);
      updateSlide(index, { imageUrl: dataUrl });
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

  return (
    <div className="page-stack">
      {/* Live Preview Card */}
      <AdminCard
        title="Предпросмотр слайдера на витрине"
        subtitle="Так баннер будет отображаться на главной странице маркетплейса"
      >
        <div
          className="admin-slider-preview-wrap"
          style={{
            background: activeSlide?.imageUrl
              ? `linear-gradient(rgba(15,23,42,0.65), rgba(15,23,42,0.65)), url(${activeSlide.imageUrl}) center/cover`
              : activeGradient,
            borderRadius: '20px',
            padding: '36px 32px',
            color: '#ffffff',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                fontSize: '28px',
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
                fontSize: '14.5px',
                margin: 0,
                maxWidth: '520px',
              }}
            >
              {activeSlide?.subtitle || 'Подзаголовок или описание предложения'}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '24px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <span
              style={{
                background: '#ffffff',
                color: '#0f172a',
                padding: '10px 20px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {activeSlide?.buttonText || 'Смотреть'} →
            </span>

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
          <button type="button" className="primary" onClick={addSlide}>
            + Добавить слайд
          </button>
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
                      gap: '10px',
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

                  <div>
                    <label>
                      Изображение баннера
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                          marginTop: '6px',
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
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
                              fontSize: '12px',
                              padding: '4px 10px',
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
                      <input
                        type="text"
                        placeholder="URL изображения (/banners/... или https://...)"
                        value={s.imageUrl || ''}
                        onChange={(e) =>
                          updateSlide(index, {
                            imageUrl: e.target.value.trim() || null,
                          })
                        }
                        style={{ marginBottom: '8px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Или загрузите файл (с камеры или галереи, до 20 МБ —
                        автосжатие):
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => handleFileUpload(index, e)}
                      />
                    </label>
                    {s.imageUrl && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <img
                          src={s.imageUrl}
                          alt="Миниатюра"
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
                          onClick={() => updateSlide(index, { imageUrl: null })}
                        >
                          Убрать изображение
                        </button>
                      </div>
                    )}
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
