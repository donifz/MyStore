import type { ButtonHTMLAttributes } from 'react';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
) {
  return `sf-button sf-button--${variant} sf-button--${size} ${className}`.trim();
}
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};
export default function Button({
  variant,
  size,
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className="sf-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
