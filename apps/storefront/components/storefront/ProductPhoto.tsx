'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// Never show a browser's broken-image glyph when a photo disappears or fails.
export default function ProductPhoto({
  src,
  alt,
  loading = 'lazy',
}: {
  src?: string;
  alt: string;
  loading?: 'lazy' | 'eager';
}) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // A broken data URL may fail during SSR, before React hydrates and
  // attaches onError. Also check the completed image on mount/source change.
  useEffect(() => {
    const image = imageRef.current;
    setFailed(Boolean(image?.complete && image.naturalWidth === 0));
  }, [src]);
  if (!src || failed) {
    return (
      <span className="sf-product-placeholder" role="img" aria-label={alt}>
        <Icon name="box" width={52} height={52} />
      </span>
    );
  }
  return (
    <img
      ref={imageRef}
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
