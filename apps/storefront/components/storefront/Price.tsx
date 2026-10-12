import { formatSom } from '../../lib/public-api';
export default function Price({
  minor,
  className = '',
}: {
  minor: number;
  className?: string;
}) {
  return <span className={`sf-price ${className}`}>{formatSom(minor)}</span>;
}
