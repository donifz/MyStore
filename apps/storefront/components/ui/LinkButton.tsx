import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonClass, type ButtonVariant, type ButtonSize } from './Button';
type Props = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};
export default function LinkButton({
  variant,
  size,
  className,
  ...props
}: Props) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}
