import type { ReactNode } from 'react';
export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="sf-empty">
      <span className="sf-empty__icon" aria-hidden="true">
        ↗
      </span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </section>
  );
}
