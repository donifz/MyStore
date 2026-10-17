# Эксплуатация MyStore

## Проверки здоровья

- `GET /api/health/live` — процесс отвечает.
- `GET /api/health/ready` — PostgreSQL доступен; ответ также показывает размер и возраст необработанного outbox.
- Алерт должен срабатывать при недоступной БД, росте `outboxPending`, росте `outboxOldestSeconds`, заполнении диска и серии HTTP 5xx.

## Резервное копирование и восстановление

Цель ТЗ: RPO ≤ 1 час и RTO ≤ 4 часа. Одного ежедневного `pg_dump` для этого недостаточно: на production необходимо включить непрерывное архивирование/WAL у провайдера PostgreSQL либо PITR с интервалом не хуже одного часа.

Ручная контрольная копия перед релизом:

```bash
set -euo pipefail
test -n "${DATABASE_URL:?Set the source database URL}"
test -n "${RESTORE_DATABASE_URL:?Set a separate, empty restore database URL}"
SOURCE_DATABASE_NAME="$(psql "$DATABASE_URL" -Atc 'SELECT current_database()')"
RESTORE_DATABASE_NAME="$(psql "$RESTORE_DATABASE_URL" -Atc 'SELECT current_database()')"
test "$SOURCE_DATABASE_NAME" != "$RESTORE_DATABASE_NAME"
RESTORE_OBJECTS="$(psql "$RESTORE_DATABASE_URL" -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND c.relkind IN ('r','p','v','m','S','f')")"
test "$RESTORE_OBJECTS" = 0
BACKUP_FILE="${BACKUP_FILE:-mystore-$(date -u +%Y%m%dT%H%M%SZ).dump}"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE" > /dev/null
shasum -a 256 "$BACKUP_FILE"
```

Проверка восстановления выполняется только в отдельную пустую базу:

```bash
pg_restore --exit-on-error --no-owner --no-acl \
  --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
DATABASE_URL="$RESTORE_DATABASE_URL" npm run migration:run --workspace apps/api
```

Создайте целевую базу заранее и убедитесь, что она пуста. Сверьте имя базы источника и назначения, затем сравните до/после количество миграций, магазинов, вариантов, движений склада, продаж, заказов, платежей и возвратов. Команда восстановления намеренно не использует `--clean`: она должна завершиться ошибкой, если база назначения не пустая. Сохраните размер и контрольную сумму копии, версии PostgreSQL, длительность выгрузки/восстановления, число ошибок и итог проверки приложения. Не публикуйте URL подключения, секреты или содержимое строк.

Рабочий прогон на изолированной тестовой базе PostgreSQL 18 записан в [отчёте восстановления и локальной нагрузки](verification/2026-10-17-backup-restore-rehearsal.md). Он подтверждает процедуру на небольшой тестовой выборке, но сам по себе не подтверждает PITR, целевые RPO/RTO или производительность production.

Для короткой локальной проверки GET-нагрузки используется `scripts/ops-load-probe.cjs`. По умолчанию он обращается только к `127.0.0.1:3001`, выдаёт не более 50 запросов в секунду в течение 30 секунд, ограничивает пул 200 одновременными запросами и считает p50/p95/p99/max. Удалённый URL отклоняется, пока явно не выставлен `LOAD_ALLOW_REMOTE=1`; этот override не следует использовать для production-проверок без согласованного окна и изолированной среды.

## Уведомления и outbox

Изменения статуса заказа и решения модерации создают внутреннее уведомление и outbox-событие в той же транзакции. Email отправляет SMTP worker либо встроенный процесс Gmail API ([Gmail на Free Render](gmail-setup.md)): [настройка и эксплуатация](email-setup.md). `email_expanded_at` означает создание адресных доставок, а не успех отправки. Успех хранится в `email_deliveries.sent_at`; прежний `processed_at` не используется как подтверждение SMTP. SMS не подключён. Контролируйте emailPending/emailFailed/emailOldestSeconds и логи worker.

## ККМ

Продажи MyStore не считаются фискализированными, пока не выбран и не сертифицирован провайдер ККМ. `KKM_PROVIDER` лишь включает интеграционный слой для разработки. В production endpoint постановки на фискализацию намеренно заблокирован до реализации и приёмки конкретного адаптера.

Перед коммерческим запуском необходимо зафиксировать провайдера, протокол, credential storage, retry/idempotency, формат чека, возврат/аннулирование, обработку неизвестного результата и пройти тест на реальной зарегистрированной кассе.
