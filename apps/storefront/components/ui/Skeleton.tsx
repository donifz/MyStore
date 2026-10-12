import type { HTMLAttributes } from 'react';
export default function Skeleton({
  className = '',
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, 'aria-hidden'>) {
  return (
    <div {...props} aria-hidden="true" className={`sf-skeleton ${className}`} />
  );
}
