import { useEffect, useRef, useState } from 'react';
import { api, errorText } from '../api/client';
import type { Variant } from '../api/types';
import { photoFrom } from './product-photo';
import SquareCameraCapture from './SquareCameraCapture';
import { usePhotoCropQueue } from './use-photo-crop-queue';

export default function EditProductPhotos({
  shopId,
  variant,
  onSaved,
}: {
  shopId: string;
  variant: Variant;
  onSaved?: (updated: Variant) => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoCrop = usePhotoCropQueue((added) => {
    setPhotos((current) => [...current, ...added]);
    setMessage('');
  });
  useEffect(() => {
    const fallback = variant.photoUrl ? [variant.photoUrl] : [];
    setPhotos(variant.photoUrls ?? fallback);
  }, [variant.id, variant.photoUrl, variant.photoUrls]);

  function add(files: FileList | null) {
    if (!files?.length) return;
    if (photos.length + files.length > 8) {
      setError('Допускается не более восьми фотографий.');
      return;
    }
    setError('');
    photoCrop.choose(files);
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
          if (!response.ok)
            throw new Error('Не удалось загрузить старое фото.');
          const blob = await response.blob();
          const file = new File([blob], 'product.jpg', {
            type: 'image/jpeg',
          });
          return photoFrom(file);
        }),
      );
      const updated = await api<Variant>(
        `/shops/${shopId}/variants/${variant.id}/photos`,
        {
          method: 'PUT',
          body: { photoDataUrls },
        },
      );
      onSaved?.(updated);
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
    <section
      className="admin-kit-card product-detail-photos"
      aria-label="Фотографии товара"
    >
      <div className="admin-kit-card-head">
        <div>
          <h2>Фотографии товара</h2>
          <p className="muted">
            До 8 фотографий. Первое фото — главное. Изменения появятся на
            витрине после модерации.
          </p>
        </div>
      </div>
      <div className="product-photo-grid">
        {photos.map((photo, index) => (
          <div key={index} className="product-photo-tile">
            <img src={photo} alt={`Фото ${index + 1}`} />
            <div className="product-photo-tile__meta">
              <span
                className={
                  index === 0 ? 'admin-kit-status green' : 'admin-kit-status'
                }
              >
                {index === 0 ? 'Главное фото' : `Фото ${index + 1}`}
              </span>
              <div className="product-photo-tile__actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                >
                  Раньше
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || index === photos.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Позже
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setPhotos((current) =>
                      current.filter((_, i) => i !== index),
                    );
                    setMessage('');
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="product-photo-footer">
        <input
          ref={cameraInputRef}
          type="file"
          aria-label="Снять фото на камеру"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          style={{ display: 'none' }}
          disabled={
            busy || photoCrop.cropping || cameraOpen || photos.length >= 8
          }
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="secondary"
          disabled={
            busy || photoCrop.cropping || cameraOpen || photos.length >= 8
          }
          onClick={() => {
            setError('');
            setCameraOpen(true);
          }}
        >
          Сфотографировать
        </button>
        <label className="product-photo-upload">
          Добавить из галереи
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={
              busy || photoCrop.cropping || cameraOpen || photos.length >= 8
            }
            onChange={(e) => {
              add(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? 'Сохранение…' : 'Сохранить фотографии'}
        </button>
      </div>
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
      {photoCrop.cropDialog}
      {cameraOpen && (
        <SquareCameraCapture
          onPhoto={(dataUrl) => {
            setPhotos((current) =>
              current.length >= 8 ? current : [...current, dataUrl],
            );
            setMessage('');
            setError('');
          }}
          onClose={() => setCameraOpen(false)}
          onFallback={() => cameraInputRef.current?.click()}
        />
      )}
    </section>
  );
}
