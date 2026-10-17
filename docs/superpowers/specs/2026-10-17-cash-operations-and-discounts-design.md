# Спецификация: Кассовые операции (внесение/изъятие наличных и обоснованные скидки)

Дата: 17 октября 2026 года.
Ветка: `feat/cash-operations-and-discounts`.
Связанная задача: Часть 5 дорожной карты релиза ([2026-10-17-release-scope.md](../implementation/2026-10-17-release-scope.md)).

## 1. Цели и инварианты

1. **Внесение (Cash In) и Изъятие (Cash Out) наличных**:
   - Являются отдельными неизменяемыми документами внутри открытой смены кассира.
   - Идемпотентность: повторный запрос с тем же `Idempotency-Key` возвращает созданный документ без повторного изменения остатка.
   - Обязательное текстовое обоснование (`reason`): нельзя внести или изъять деньги без указания причины (например, «Разменный фонд», «Инкассация выручки», «Хозяйственные расходы»).
   - **Финансовая изоляция**:
     - Внесение и изъятие изменяют **только ожидаемый остаток наличных в кассе** (`expectedCashMinor`).
     - **Не влияют на выручку** (`salesCashMinor`, `salesCardMinor`).
     - **Не влияют на склад и остатки товаров** (`stock_balances`, `stock_movements`).
   - **Барьер отрицательной кассы**:
     - Попытка изъять сумму, превышающую текущий остаток наличных в кассе смены, немедленно отклоняется с ошибкой `400 Bad Request` («Withdrawal amount exceeds cash in register»).
   - **Сверка при закрытии смены**:
     - Ожидаемый остаток наличных в кассе рассчитывается детерминированно:
       `expectedCash = openingCash + cashSales - cashReturns + cashIn - cashOut`.
     - Расхождение фиксируется относительно этой формулы.

2. **Обоснованные скидки на позиции чека**:
   - Скидка указывается на уровне строки чека (`discountMinor` за единицу товара в целых тыйынах).
   - Обязательное обоснование (`discountReason`): при `discountMinor > 0` причина обязательна (например, «Витринный образец», «Скидка постоянному клиенту», «Повреждение коробки»).
   - Ограничение суммы: скидка не может превышать исходную цену товара (`discountMinor <= originalPriceMinor`), цена продажи не может быть отрицательной.
   - Права доступа:
     - Кассир (`cashier`): может применять скидку не более 20% от цены товара.
     - Владелец (`owner`) и управляющий (`manager`): могут применять любую скидку до 100%.
   - **Сохранение снимка (Snapshot)**:
     - В `sale_lines` сохраняются `discount_minor`, `discount_reason`, `discount_actor_id`.
     - `unit_price_minor` хранит **фактически оплаченную цену за вычетом скидки** (`originalPriceMinor - discountMinor`).
   - **Справедливый возврат**:
     - При возврате покупателю возвращается ровно та сумма, которую он фактически заплатил за единицу товара (`unit_price_minor`), а не исходная цена до скидки.

## 2. Схема базы данных

Миграция `1760000000022-CashOperationsAndDiscounts.ts`:
```sql
CREATE TABLE cash_transactions (
  id uuid PRIMARY KEY,
  shop_id uuid NOT NULL,
  shift_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id),
  type text NOT NULL CHECK(type IN ('in', 'out')),
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  reason text NOT NULL CHECK(char_length(trim(reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (shop_id, shift_id) REFERENCES cash_shifts(shop_id, id) ON DELETE CASCADE
);

CREATE INDEX cash_transactions_shift_idx ON cash_transactions(shop_id, shift_id, created_at);

ALTER TABLE sale_lines
  ADD COLUMN IF NOT EXISTS discount_minor bigint NOT NULL DEFAULT 0 CHECK(discount_minor >= 0),
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS discount_actor_id uuid REFERENCES users(id);
```

## 3. API контракты

- `POST /shops/:shopId/pos/shifts/:shiftId/cash-in`:
  - Заголовки: `Idempotency-Key`
  - Тело: `{ amountMinor: number, reason: string }`
  - Ответ: `CashTransactionView`
- `POST /shops/:shopId/pos/shifts/:shiftId/cash-out`:
  - Заголовки: `Idempotency-Key`
  - Тело: `{ amountMinor: number, reason: string }`
  - Ответ: `CashTransactionView`
- `GET /shops/:shopId/pos/shifts/:shiftId/transactions`:
  - Ответ: `CashTransactionView[]`
- `POST /shops/:shopId/pos/sales`:
  - В каждой строке `lines`: опциональные `discountMinor?: number`, `discountReason?: string`.

## 4. Пользовательский интерфейс

1. **Касса (POS)**:
   - В интерфейсе продажи кассир может нажать «Скидка» на позиции чека, ввести размер скидки в сомах и выбрать/указать причину.
   - Итог чека пересчитывается мгновенно в сомах и тыйынах.
2. **Смена кассы (`ShiftPage.tsx`)**:
   - Кнопки «Внесение наличных» и «Изъятие наличных» с модальным окном ввода суммы и обязательной причины.
   - Таблица/список движений наличных в смене: тип, время, сумма, кассир, причина.
   - Детализация ожидаемого остатка:
     - Начальный остаток
     - Продажи наличными
     - Внесения (+)
     - Изъятия (-)
     - Возвраты наличными (-)
     - Итоговый ожидаемый остаток.
