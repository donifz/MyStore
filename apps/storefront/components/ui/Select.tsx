import type { SelectHTMLAttributes } from 'react';
import Field, { descriptionIds, type FieldProps } from './Field';
export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> &
  FieldProps;
export default function Select({
  id,
  label,
  hint,
  error,
  className = '',
  children,
  ...props
}: SelectProps) {
  return (
    <Field {...{ id, label, hint, error }}>
      <select
        {...props}
        id={id}
        className={`sf-input sf-select ${className}`}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={descriptionIds(
          id,
          hint,
          error,
          props['aria-describedby'],
        )}
      >
        {children}
      </select>
    </Field>
  );
}
