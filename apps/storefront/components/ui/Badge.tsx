import type { HTMLAttributes } from 'react';
export type Tone = 'neutral' | 'success' | 'warning' | 'danger';
export default function Badge({
  variant = 'neutral',
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Tone }) {
  return (
    <span {...props} className={`sf-badge sf-badge--${variant} ${className}`} />
  );
}
