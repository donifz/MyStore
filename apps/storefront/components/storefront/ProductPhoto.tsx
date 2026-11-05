'use client';

import { useEffect, useState } from 'react';
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
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <span className="sf-product-placeholder" role="img" aria-label={alt}>
        <Icon name="box" width={52} height={52} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
