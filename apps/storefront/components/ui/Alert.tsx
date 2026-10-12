import type { HTMLAttributes } from 'react';
export default function Alert({
  variant = 'info',
  className = '',
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, 'role'> & {
  variant?: 'info' | 'success' | 'error';
}) {
  return (
    <div
      {...props}
      role={variant === 'error' ? 'alert' : 'status'}
      className={`sf-alert sf-alert--${variant} ${className}`}
    />
  );
}
