import EmailSettings from './EmailSettings';
import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { formatSom } from '../api/money';

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
};

type Audit = {
  id: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

type AuditCategory =
  'all' | 'pos' | 'orders' | 'inventory' | 'staff' | 'settings';

function formatAuditEntry(item: Audit): {
  badge: string;
  badgeClass: string;
  title: string;
  category: AuditCategory;
  tags: Array<{ label: string; value: string }>;
} {
  const details = item.details || {};
  const kind = String(details.kind || '');
  const action = item.action;
  const entityType = item.entityType;

  // 1. Stock documents / POS / Receiving
  if (entityType === 'stock_document') {
    if (kind === 'sale') {
      return {
        badge: 'Продажа',
        badgeClass: 'status-pill status-active',
        title: 'Продажа на кассе',
        category: 'pos',
        tags: [
          ...(details.number
            ? [{ label: 'Документ №', value: String(details.number) }]
            : []),
          ...(details.lines_count
            ? [{ label: 'Позиций', value: String(details.lines_count) }]
            : []),
        ],
      };
    }
    if (kind === 'receiving') {
      return {
        badge: 'Приёмка',
        badgeClass: 'status-pill status-active',
        title: 'Приход товара на склад',
        category: 'inventory',
        tags: [
          ...(details.number
            ? [{ label: 'Документ №', value: String(details.number) }]
            : []),
          ...(details.lines_count
            ? [{ label: 'Позиций', value: String(details.lines_count) }]
            : []),
        ],
      };
    }
    if (kind === 'return') {
      return {
        badge: 'Возврат',
        badgeClass: 'status-pill status-archived',
        title: 'Возврат товара покупателем',
        category: 'pos',
        tags: [
          ...(details.number
            ? [{ label: 'Документ №', value: String(details.number) }]
            : []),
          ...(details.reason
            ? [{ label: 'Причина', value: String(details.reason) }]
            : []),
        ],
      };
    }
    if (kind === 'cash_in') {
      return {
        badge: 'Внесение',
        badgeClass: 'status-pill status-active',
        title: 'Внесение наличных в кассу',
        category: 'pos',
        tags: [
          ...(details.amountMinor || details.amount
            ? [
                {
                  label: 'Сумма',
                  value: formatSom(
                    Number(details.amountMinor || details.amount),
                  ),
                },
              ]
            : []),
          ...(details.reason
            ? [{ label: 'Причина', value: String(details.reason) }]
            : []),
        ],
      };
    }
    if (kind === 'cash_out') {
      return {
        badge: 'Изъятие',
        badgeClass: 'status-pill status-archived',
        title: 'Изъятие наличных из кассы',
        category: 'pos',
        tags: [
          ...(details.amountMinor || details.amount
            ? [
                {
                  label: 'Сумма',
                  value: formatSom(
                    Number(details.amountMinor || details.amount),
                  ),
                },
              ]
            : []),
          ...(details.reason
            ? [{ label: 'Причина', value: String(details.reason) }]
            : []),
        ],
      };
    }
  }

  // 2. Payment records
  if (entityType === 'payment_record') {
    const methodStr =
      details.method === 'cash'
        ? 'Наличные'
        : details.method === 'card'
          ? 'Карта'
          : String(details.method || '');
    return {
      badge: 'Оплата',
      badgeClass: 'status-pill status-active',
      title: 'Фиксация оплаты',
      category: 'pos',
      tags: [
        ...(methodStr ? [{ label: 'Способ', value: methodStr }] : []),
        ...(details.amount || details.amountMinor
          ? [
              {
                label: 'Сумма',
                value: formatSom(Number(details.amount || details.amountMinor)),
              },
            ]
          : []),
      ],
    };
  }

  // 3. Orders
  if (entityType === 'order') {
    const statusMap: Record<string, string> = {
      new: 'Новый',
      confirmed: 'Подтверждён',
      ready: 'Готов к выдаче',
      completed: 'Выдан',
      canceled: 'Отменён',
    };
    const fromStr =
      statusMap[String(details.from)] || String(details.from || '');
    const toStr = statusMap[String(details.to)] || String(details.to || '');
    return {
      badge: 'Заказ',
      badgeClass: 'status-pill',
      title: 'Смена статуса онлайн-заказа',
      category: 'orders',
      tags: [
        ...(fromStr && toStr
          ? [{ label: 'Статус', value: `${fromStr} → ${toStr}` }]
          : []),
        ...(item.entityId
          ? [{ label: 'ID', value: item.entityId.slice(0, 8) }]
          : []),
      ],
    };
  }

  // 4. Staff
  if (entityType === 'staff' || action.startsWith('staff:')) {
    const roleMap: Record<string, string> = {
      owner: 'Владелец',
      manager: 'Менеджер',
      cashier: 'Кассир',
    };
    if (action === 'staff:invite') {
      return {
        badge: 'Сотрудники',
        badgeClass: 'status-pill status-active',
        title: 'Приглашение сотрудника',
        category: 'staff',
        tags: [
          ...(details.role
            ? [
                {
                  label: 'Роль',
                  value: roleMap[String(details.role)] || String(details.role),
                },
              ]
            : []),
        ],
      };
    }
    if (action === 'staff:role') {
      return {
        badge: 'Сотрудники',
        badgeClass: 'status-pill',
        title: 'Изменение роли сотрудника',
        category: 'staff',
        tags: [
          ...(details.role
            ? [
                {
                  label: 'Новая роль',
                  value: roleMap[String(details.role)] || String(details.role),
                },
              ]
            : []),
        ],
      };
    }
    if (action === 'staff:permissions') {
      const perms: string[] = [];
      if (details.canReturn !== undefined)
        perms.push(`Возвраты: ${details.canReturn ? 'да' : 'нет'}`);
      if (details.canViewReports !== undefined)
        perms.push(`Отчёты: ${details.canViewReports ? 'да' : 'нет'}`);
      return {
        badge: 'Права',
        badgeClass: 'status-pill',
        title: 'Настройка прав сотрудника',
        category: 'staff',
        tags: perms.map((p) => ({ label: 'Право', value: p })),
      };
    }
    if (action === 'staff:cancel') {
      return {
        badge: 'Сотрудники',
        badgeClass: 'status-pill status-archived',
        title: 'Отзыв приглашения',
        category: 'staff',
        tags: [],
      };
    }
    if (action === 'staff:accept') {
      return {
        badge: 'Сотрудники',
        badgeClass: 'status-pill status-active',
        title: 'Принятие приглашения',
        category: 'staff',
        tags: [],
      };
    }
  }

  // 5. Variants / Catalog
  if (action.startsWith('variant:') || entityType === 'variant') {
    if (action === 'variant:archive') {
      return {
        badge: 'Каталог',
        badgeClass: 'status-pill status-archived',
        title: 'Архивирование товара',
        category: 'inventory',
        tags: [
          ...(item.entityId
            ? [{ label: 'Вариант', value: item.entityId.slice(0, 8) }]
            : []),
        ],
      };
    }
    if (action === 'variant:restore') {
      return {
        badge: 'Каталог',
        badgeClass: 'status-pill status-active',
        title: 'Восстановление из архива',
        category: 'inventory',
        tags: [
          ...(item.entityId
            ? [{ label: 'Вариант', value: item.entityId.slice(0, 8) }]
            : []),
        ],
      };
    }
    if (action === 'variant:group') {
      return {
        badge: 'Каталог',
        badgeClass: 'status-pill',
        title: 'Группировка вариантов',
        category: 'inventory',
        tags: [
          ...(details.size
            ? [{ label: 'Размер', value: String(details.size) }]
            : []),
          ...(details.color
            ? [{ label: 'Цвет', value: String(details.color) }]
            : []),
        ],
      };
    }
  }

  // 6. Platform financial grants
  if (entityType === 'platform_financial_grant') {
    return {
      badge: 'Платформа',
      badgeClass: 'status-pill',
      title:
        action === 'grant'
          ? 'Выдача финансового доступа'
          : action === 'revoke'
            ? 'Отзыв финансового доступа'
            : 'Просмотр финансов платформой',
      category: 'staff',
      tags: [
        ...(details.purpose
          ? [{ label: 'Цель', value: String(details.purpose) }]
          : []),
      ],
    };
  }

  // 7. Storefront & Settings
  if (action === 'schedule:update' || entityType === 'schedule') {
    return {
      badge: 'Расписание',
      badgeClass: 'status-pill',
      title: 'Рабочие часы и часовой пояс',
      category: 'settings',
      tags: [
        ...(details.timeZone
          ? [{ label: 'Часовой пояс', value: String(details.timeZone) }]
          : []),
      ],
    };
  }
  if (action.startsWith('marketplace:')) {
    return {
      badge: 'Маркетплейс',
      badgeClass:
        action === 'marketplace:block'
          ? 'status-pill status-archived'
          : 'status-pill status-active',
      title:
        action === 'marketplace:block'
          ? 'Блокировка витрины маркетплейса'
          : 'Разблокировка витрины',
      category: 'settings',
      tags: [
        ...(details.reason
          ? [{ label: 'Причина', value: String(details.reason) }]
          : []),
      ],
    };
  }
  if (action.startsWith('subscription:')) {
    return {
      badge: 'Подписка',
      badgeClass: 'status-pill status-active',
      title: 'Обновление срока подписки',
      category: 'settings',
      tags: [
        ...(details.activeUntil
          ? [
              {
                label: 'Активна до',
                value: String(details.activeUntil).slice(0, 10),
              },
            ]
          : []),
      ],
    };
  }
  if (action === 'email:retry') {
    return {
      badge: 'Почта',
      badgeClass: 'status-pill',
      title: 'Повторная отправка email',
      category: 'settings',
      tags: [],
    };
  }

  // Fallback
  return {
    badge: action.slice(0, 16),
    badgeClass: 'status-pill',
    title: `${entityType}: ${action}`,
    category: 'all',
    tags: Object.entries(details)
      .filter(
        ([_, v]) =>
          typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean',
      )
      .slice(0, 3)
      .map(([k, v]) => ({ label: k, value: String(v) })),
  };
}

export default function OperationsPage() {
  const { shopId = '' } = useParams();
  const session = useSession();
  const shop = session.user?.shops.find((x) => x.id === shopId);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<AuditCategory>('all');
  const [showRawJson, setShowRawJson] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = async () => {
    try {
      setNotifications(
        await api<Notification[]>(`/shops/${shopId}/notifications`),
      );
      if (shop?.role === 'owner')
        setAudit(await api<Audit[]>(`/shops/${shopId}/audit`));
    } catch (e) {
      setError(errorText(e));
    }
  };

  useEffect(() => {
    void load();
  }, [shopId, shop?.role]);

  const markRead = async (item: Notification) => {
    if (item.readAt) return;
    try {
      await api(`/shops/${shopId}/notifications/${item.id}/read`, {
        method: 'POST',
      });
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const formattedAudit = useMemo(() => {
    return audit.map((item) => ({
      item,
      info: formatAuditEntry(item),
    }));
  }, [audit]);

  const filteredAudit = useMemo(() => {
    const q = search.trim().toLowerCase();
    return formattedAudit.filter(({ item, info }) => {
      if (category !== 'all' && info.category !== category) return false;
      if (!q) return true;
      const matchTitle = info.title.toLowerCase().includes(q);
      const matchBadge = info.badge.toLowerCase().includes(q);
      const matchEntity = item.entityType.toLowerCase().includes(q);
      const matchAction = item.action.toLowerCase().includes(q);
      const matchTags = info.tags.some(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.value.toLowerCase().includes(q),
      );
      return (
        matchTitle || matchBadge || matchEntity || matchAction || matchTags
      );
    });
  }, [formattedAudit, category, search]);

  const paginatedAudit = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAudit.slice(start, start + pageSize);
  }, [filteredAudit, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAudit.length / pageSize));

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">События магазина</p>
          <h1>Уведомления и аудит</h1>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="panel">
        <h2>Уведомления</h2>
        {!notifications.length && (
          <p className="muted">Новых событий пока нет.</p>
        )}
        <div className="stack">
          {notifications.map((item) => (
            <button
              type="button"
              className="notification-row"
              key={item.id}
              onClick={() => void markRead(item)}
            >
              <span>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </span>
              <span>{item.readAt ? 'Прочитано' : 'Новое'}</span>
            </button>
          ))}
        </div>
      </div>
      <EmailSettings shopId={shopId} owner={shop?.role === 'owner'} />
      {shop?.role === 'owner' && (
        <div className="panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Журнал аудита</h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                История ключевых действий сотрудников, кассовых операций и
                изменений прав.
              </p>
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
              }}
            >
              <input
                type="checkbox"
                checked={showRawJson}
                onChange={(e) => setShowRawJson(e.target.checked)}
              />
              Сырые данные (JSON)
            </label>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <input
              type="search"
              aria-label="Поиск по журналу аудита"
              placeholder="Поиск по событию, номеру или детали..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ flex: '1 1 240px', minWidth: '200px' }}
            />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(
                [
                  ['all', 'Все'],
                  ['pos', 'Касса и продажи'],
                  ['orders', 'Заказы'],
                  ['inventory', 'Склад и товары'],
                  ['staff', 'Сотрудники и права'],
                  ['settings', 'Настройки'],
                ] as const
              ).map(([catKey, catLabel]) => (
                <button
                  type="button"
                  key={catKey}
                  className={category === catKey ? 'primary' : 'secondary'}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.825rem',
                    minHeight: '36px',
                  }}
                  onClick={() => {
                    setCategory(catKey);
                    setPage(1);
                  }}
                >
                  {catLabel}
                </button>
              ))}
            </div>
          </div>

          {!filteredAudit.length ? (
            <p className="empty-state">События не найдены.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Время</th>
                    <th style={{ width: '130px' }}>Событие</th>
                    <th>Описание и детали</th>
                    {showRawJson && <th>JSON</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedAudit.map(({ item, info }) => (
                    <tr key={item.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {new Date(item.createdAt).toLocaleString('ru-RU')}
                      </td>
                      <td>
                        <span className={info.badgeClass}>{info.badge}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                          {info.title}
                        </div>
                        {info.tags.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              gap: '6px',
                              flexWrap: 'wrap',
                              marginTop: '4px',
                            }}
                          >
                            {info.tags.map((t, idx) => (
                              <span
                                key={idx}
                                style={{
                                  background: '#f1f5f9',
                                  color: '#334155',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  display: 'inline-block',
                                }}
                              >
                                <strong>{t.label}:</strong> {t.value}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      {showRawJson && (
                        <td>
                          <code
                            style={{
                              fontSize: '0.75rem',
                              display: 'block',
                              maxWidth: '300px',
                              overflowX: 'auto',
                            }}
                          >
                            {JSON.stringify(item.details)}
                          </code>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Назад
              </button>
              <span style={{ fontSize: '0.875rem' }}>
                Страница {page} из {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Далее
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
