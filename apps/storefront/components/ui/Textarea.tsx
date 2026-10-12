import type { TextareaHTMLAttributes } from 'react';
import Field, { descriptionIds, type FieldProps } from './Field';
export type TextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> &
  FieldProps;
export default function Textarea({
  id,
  label,
  hint,
  error,
  className = '',
  ...props
}: TextareaProps) {
  return (
    <Field {...{ id, label, hint, error }}>
      <textarea
        {...props}
        id={id}
        className={`sf-input sf-textarea ${className}`}
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
