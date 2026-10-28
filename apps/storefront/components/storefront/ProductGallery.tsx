'use client';
import { useEffect, useRef, useState } from 'react';
import { distinctPhotoUrls } from './gallery-photos';
import Icon from './Icon';
export default function ProductGallery({
  photoUrl,
  photoUrls,
  name,
}: {
  photoUrl?: string;
  photoUrls?: string[];
  name: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  const sourcePhotos = [
    ...new Set(photoUrls?.length ? photoUrls : photoUrl ? [photoUrl] : []),
  ]
    .filter(Boolean)
    .slice(0, 8);
  const photoKey = sourcePhotos.join('|');
  const [uniquePhotos, setUniquePhotos] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUniquePhotos(null);
    if (sourcePhotos.length < 2) return;
    void distinctPhotoUrls(
      sourcePhotos,
      async (url) => {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Photo unavailable');
        return response.arrayBuffer();
      },
      (bytes) => crypto.subtle.digest('SHA-256', bytes),
    ).then((result) => {
      if (!cancelled) setUniquePhotos(result);
    });
    return () => {
      cancelled = true;
    };
  }, [photoKey]);
  const photos = uniquePhotos ?? sourcePhotos.slice(0, 1);
  const photo = photos[Math.min(active, photos.length - 1)];
  return (
    <div className="sf-gallery">
      {photo ? (
        <>
          <button
            className="sf-gallery-main"
            type="button"
            aria-label="Увеличить фото товара"
            onClick={() => dialog.current?.showModal()}
          >
            <img src={photo} alt={name} />
          </button>
          {photos.length > 1 && (
            <div
              className="sf-gallery-thumbnails"
              aria-label="Фотографии товара"
            >
              {photos.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  aria-label={`Фото ${index + 1} из ${photos.length}`}
                  aria-pressed={index === active}
                  onClick={() => setActive(index)}
                >
                  <img src={url} alt={`Фото ${index + 1}`} />
                </button>
              ))}
            </div>
          )}
          <dialog
            ref={dialog}
            className="sf-photo-dialog"
            onClick={(e) => {
              if (e.target === e.currentTarget) dialog.current?.close();
            }}
          >
            <button
              type="button"
              className="sf-button sf-button--secondary"
              onClick={() => dialog.current?.close()}
            >
              Закрыть ×
            </button>
            <img src={photo} alt={name} />
          </dialog>
        </>
      ) : (
        <div className="sf-gallery-main sf-no-photo">
          <Icon name="box" width={80} height={80} />
          <span>Магазин пока не добавил фото</span>
        </div>
      )}
    </div>
  );
}
