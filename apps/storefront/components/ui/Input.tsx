import type { InputHTMLAttributes } from 'react';
import Field, { descriptionIds, type FieldProps } from './Field';
export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> &
  FieldProps;
export default function Input({
  id,
  label,
  hint,
  error,
  className = '',
  ...props
}: InputProps) {
  return (
    <Field {...{ id, label, hint, error }}>
      <input
        {...props}
        id={id}
        className={`sf-input ${className}`}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={descriptionIds(
          id,
          hint,
          error,
          props['aria-describedby'],
        )}
      />
    </Field>
  );
}
