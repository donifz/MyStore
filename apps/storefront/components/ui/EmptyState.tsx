import type { ReactNode } from 'react';
import Icon from '../storefront/Icon';

export default function EmptyState({
  title,
  description,
  action,
  icon = 'shop',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <section className="sf-empty">
      <div className="sf-empty__art" aria-hidden="true">
        <span className="sf-empty__glow" />
        <span className="sf-empty__icon-badge">
          <Icon name={icon} width={34} height={34} />
        </span>
      </div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="sf-empty__actions">{action}</div>}
    </section>
  );
}
