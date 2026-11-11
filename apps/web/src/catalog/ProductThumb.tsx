import { useEffect, useState } from 'react';

export default function ProductThumb({
  photoUrl,
  name,
  className = 'catalog-thumb',
  iconSize = 18,
}: {
  photoUrl?: string;
  name: string;
  className?: string;
  iconSize?: number;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  if (photoUrl && !failed) {
    return (
      <span className={className}>
        <img
          src={photoUrl}
          alt={name}
          className="catalog-thumb__img"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`${className} catalog-thumb--placeholder`}
      aria-label="Фото по умолчанию"
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    </span>
  );
}
