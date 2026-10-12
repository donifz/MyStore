import type { InputHTMLAttributes } from 'react';
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
};
export default function Checkbox({ label, className = '', ...props }: Props) {
  return (
    <label className={`sf-checkbox ${className}`}>
      <input {...props} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}
