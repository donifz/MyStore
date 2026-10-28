import { ChangeEvent } from 'react';
import { ThemeBlock } from './types';

export default function BannerEditor({
  value,
  disabled,
  onChange,
}: {
  value?: ThemeBlock | null;
  disabled?: boolean;
  onChange: (value: ThemeBlock | null) => void;
}) {
  const banner = value || {};
  const update = (patch: Partial<ThemeBlock>) =>
    onChange({ ...banner, ...patch });
  const upload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ imageDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };
  return (
    <section className="theme-editor">
      <h2>Баннер витрины</h2>
      <p>
        Баннер будет постоянно отображаться вверху страницы вашего магазина.
      </p>
      <label>
        Заголовок
        <input
          maxLength={160}
          disabled={disabled}
          value={banner.title || ''}
          onChange={(e) => update({ title: e.target.value })}
        />
      </label>
      <label>
        Текст
        <textarea
          rows={3}
          maxLength={1000}
          disabled={disabled}
          value={banner.text || ''}
          onChange={(e) => update({ text: e.target.value })}
        />
      </label>
      <label>
        Изображение JPEG (до 512 КБ)
        <input
          type="file"
          accept="image/jpeg"
          disabled={disabled}
          onChange={upload}
        />
      </label>
      <label>
        Alt-текст изображения
        <input
          maxLength={160}
          disabled={disabled}
          value={banner.imageAlt || ''}
          onChange={(e) => update({ imageAlt: e.target.value })}
        />
      </label>
      <label>
        Ссылка кнопки (внутренняя или HTTPS)
        <input
          maxLength={1000}
          disabled={disabled}
          placeholder="/ или https://…"
          value={banner.link || ''}
          onChange={(e) => update({ link: e.target.value })}
        />
      </label>
      <label>
        Текст кнопки
        <input
          maxLength={80}
          disabled={disabled}
          value={banner.buttonLabel || ''}
          onChange={(e) => update({ buttonLabel: e.target.value })}
        />
      </label>
      <button
        type="button"
        className="button button--secondary"
        disabled={disabled || !value}
        onClick={() => onChange(null)}
      >
        Убрать баннер
      </button>
      <div className="theme-preview" aria-label="Предпросмотр баннера">
        <small>Предпросмотр</small>
        <strong>{banner.title || 'Название магазина'}</strong>
        {banner.text && <p>{banner.text}</p>}
      </div>
    </section>
  );
}
