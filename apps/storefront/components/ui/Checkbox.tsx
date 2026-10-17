import type { InputHTMLAttributes, ReactNode } from 'react';
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
};
export default function Checkbox({ label, className = '', ...props }: Props) {
  return (
    <label className={`sf-checkbox ${className}`}>
      <input {...props} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}
