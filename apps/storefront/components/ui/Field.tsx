import type { ReactNode } from 'react';
export type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};
export function descriptionIds(
  id: string,
  hint?: string,
  error?: string,
  existing?: string,
) {
  return (
    [existing, hint ? id + '-hint' : '', error ? id + '-error' : '']
      .filter(Boolean)
      .join(' ') || undefined
  );
}
export default function Field({
  id,
  label,
  hint,
  error,
  children,
}: FieldProps & { children: ReactNode }) {
  return (
    <div className="sf-field">
      <label htmlFor={id} className="sf-field__label">
        {label}
      </label>
      {children}
      {hint && (
        <span id={id + '-hint'} className="sf-field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={id + '-error'} className="sf-field__error">
          {error}
        </span>
      )}
    </div>
  );
}
