'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Icon from './Icon';

export default function CollapsibleFilters({
  activeCount,
  children,
  compact = false,
}: {
  activeCount: number;
  children: ReactNode;
  compact?: boolean;
}) {
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1099px)');
    const sync = () => {
      if (details.current) details.current.open = !compact && !media.matches;
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [compact]);

  return (
    <details ref={details} open={!compact}>
      <summary>
        <Icon name="filter" width={20} height={20} />
        <span>Фильтры</span>
        {activeCount > 0 && (
          <span className="sf-filter-count">Выбрано: {activeCount}</span>
        )}
      </summary>
      {children}
    </details>
  );
}
