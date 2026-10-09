import type { ReactNode } from 'react';

export function AdminCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-kit-card ${className}`}>
      <div className="admin-kit-card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminMetric({
  label,
  value,
  note,
  symbol,
  tone = 'green',
}: {
  label: string;
  value: string | number;
  note?: string;
  symbol: string;
  tone?: 'green' | 'blue' | 'amber';
}) {
  return (
    <article className="admin-kit-metric">
      <span className={`admin-kit-symbol ${tone}`} aria-hidden="true">
        {symbol}
      </span>
      <p>{label}</p>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

export function AdminStatus({
  children,
  tone = 'amber',
}: {
  children: ReactNode;
  tone?: 'amber' | 'green' | 'red' | 'neutral';
}) {
  return <span className={`admin-kit-status ${tone}`}>{children}</span>;
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <p className="admin-kit-empty">{children}</p>;
}
