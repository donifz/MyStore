'use client';
import { useRef } from 'react';
import Icon from './Icon';
export default function ProductGallery({
  photoUrl,
  name,
}: {
  photoUrl?: string;
  name: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="sf-gallery">
      {photoUrl ? (
        <>
          <button
            className="sf-gallery-main"
            type="button"
            aria-label="Увеличить фото товара"
            onClick={() => dialog.current?.showModal()}
          >
            <img src={photoUrl} alt={name} />
          </button>
          <div className="sf-gallery-thumbnails">
            <span>
              <img src={photoUrl} alt="Основное фото" />
            </span>
            <small>Нажмите на фото, чтобы рассмотреть</small>
          </div>
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
            <img src={photoUrl} alt={name} />
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
