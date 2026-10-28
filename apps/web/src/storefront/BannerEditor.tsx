import { ChangeEvent, useState } from 'react';
import { StorefrontBanner } from './types';

export default function BannerEditor({
  value,
  disabled,
  saving,
  dirty,
  saved,
  error,
  onChange,
  onSave,
}: {
  value?: StorefrontBanner | null;
  disabled?: boolean;
  saving?: boolean;
  dirty: boolean;
  saved: boolean;
  error: string;
  onChange: (value: StorefrontBanner | null) => void;
  onSave: () => void;
}) {
  const [fileError, setFileError] = useState('');
  const upload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    if (file.type !== 'image/jpeg') {
      setFileError('Прикрепите изображение JPEG.');
      e.target.value = '';
      return;
    }
    if (file.size > 512 * 1024) {
      setFileError('Размер файла не должен превышать 512 КБ.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ imageDataUrl: String(reader.result) });
    reader.onerror = () => setFileError('Не удалось прочитать изображение.');
    reader.readAsDataURL(file);
  };
  return (
    <section className="banner-editor">
      <h2>Баннер витрины</h2>
      <label htmlFor="storefront-banner-image">
        Изображение JPEG (до 512 КБ)
      </label>
      <input
        id="storefront-banner-image"
        type="file"
        accept="image/jpeg"
        disabled={disabled}
        onChange={upload}
      />
      {value?.imageDataUrl && (
        <img
          className="theme-preview-image"
          src={value.imageDataUrl}
          alt="Предпросмотр баннера"
        />
      )}
      {(fileError || error) && (
        <p className="error" role="alert">
          {fileError || error}
        </p>
      )}
      {saved && (
        <p className="success" role="status">
          Баннер сохранён.
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={disabled || saving || !dirty}
          onClick={onSave}
        >
          {saving ? 'Сохранение…' : 'Сохранить баннер'}
        </button>
        <button
          type="button"
          disabled={disabled || saving || !value}
          onClick={() => {
            setFileError('');
            onChange(null);
          }}
        >
          Убрать изображение
        </button>
      </div>
    </section>
  );
}
