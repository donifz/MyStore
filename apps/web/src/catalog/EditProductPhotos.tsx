import { useEffect, useState } from 'react';
import { api, errorText } from '../api/client';
import type { Variant } from '../api/types';
import { photoFrom } from './product-photo';

export default function EditProductPhotos({
  shopId,
  variant,
}: {
  shopId: string;
  variant: Variant;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    setPhotos(
      variant.photoUrls ?? (variant.photoUrl ? [variant.photoUrl] : []),
    );
  }, [variant.id, variant.photoUrl, variant.photoUrls]);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    if (photos.length + files.length > 8) {
      setError('Допускается не более восьми фотографий.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const added = await Promise.all(Array.from(files).map(photoFrom));
      setPhotos((current) => [...current, ...added]);
      setMessage('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const photoDataUrls = await Promise.all(
        photos.map(async (photo) => {
          if (photo.startsWith('data:')) return photo;
          const response = await fetch(photo, { credentials: 'same-origin' });
          if (!response.ok) throw new Error('Не удалось загрузить старое фото.');
          const blob = await response.blob();
          return photoFrom(
            new File([blob], 'product.jpg', { type: 'image/jpeg' }),
          );
        }),
      );
      await api(`/shops/${shopId}/variants/${variant.id}/photos`, {
        method: 'PUT',
        body: { photoDataUrls },
      });
      setMessage('Альбом сохранён и отправлен на модерацию.');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    setPhotos((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setMessage('');
  }

  return (
    <section className="panel form-panel" aria-label="Фотографии товара">
      <h2>Фотографии товара</h2>
      <p className="muted">
        До 8 фотографий. Первое фото — главное. Изменения появятся на витрине
        после модерации.
      </p>
      <div className="product-form-grid">
        {photos.map((photo, index) => (
          <div key={index} className="product-form-block">
            <img src={photo} alt={`Фото ${index + 1}`} width={160} />
            <p>{index === 0 ? 'Главное фото' : `Фото ${index + 1}`}</p>
            <button
              type="button"
              disabled={busy || index === 0}
              onClick={() => move(index, -1)}
            >
              Раньше
            </button>
            <button
              type="button"
              disabled={busy || index === photos.length - 1}
              onClick={() => move(index, 1)}
            >
              Позже
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPhotos((current) => current.filter((_, i) => i !== index));
                setMessage('');
              }}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>
      <label>
        Добавить фотографии
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || photos.length >= 8}
          onChange={(e) => {
            void add(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      <button
        type="button"
        className="primary"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? 'Сохранение…' : 'Сохранить фотографии'}
      </button>
    </section>
  );
}
