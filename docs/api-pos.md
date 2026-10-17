# API кабинета и кассы

Продолжение docs/api-inventory.md. Старые bearer-маршруты сохраняются. Браузер использует тот же origin и префикс /api; например /api/auth/me. Неизвестный /api-маршрут возвращает JSON 404, а не SPA.

## Браузерный вход

POST /auth/web/login {email,password}. Требуется Origin из WEB_ORIGINS. Ответ: {expiresIn:43200,csrfToken}. Сессия — cookie mystore_session, HttpOnly, SameSite=Lax, Secure в production, Path=/, 12 часов. GET /auth/me возвращает userId,email,csrfToken,shops:[{id,name,role,canReturn,canViewReports}]. POST /auth/web/logout отзывает сессию и очищает cookie.

Изменения с cookie требуют разрешённый Origin и x-csrf-token из /auth/me. CSRF привязан к текущей сессии. Сессия и CSRF не записываются в localStorage. Вход bearer и web разделяют ограничение 20 попыток на IP в минуту.

## Товары

GET /shops/:shopId/variants?q=&page=1&pageSize=25 → {items,total,page,pageSize}. Поиск по названию и коду, включая ведущие нули; %, _ и обратный слеш считаются обычными символами. page:1..1000000, pageSize:1..100, q до128 символов. Каждая позиция: id,name,barcode,salePriceMinor,physical,reserved,available. stockValueMinor добавляется для владельца/менеджера и кассира с canViewReports. Создание и приёмка сохраняют API первого этапа.

## Смены

Все POST требуют Idempotency-Key. Идентификаторы — UUID; суммы — целые тыйыны 0..9007199254740991.

- POST /shops/:shopId/pos/shifts {openingCashMinor} — открытие.
- GET .../pos/shifts/current — собственная открытая смена, null или {occupied:true}; чужие деньги не раскрываются.
- GET .../pos/shifts/active — открытая смена магазина; только владелец.
- GET .../pos/shifts/:id — отчёт автора или владельца.
- POST .../pos/shifts/:id/close {actualCashMinor,comment?} — закрытие; комментарий обязателен при расхождении и при закрытии чужой смены владельцем, 1..500 символов после trim.

ShiftView: id,shopId,actorId,status,openingCashMinor,expectedCashMinor,actualCashMinor,discrepancyMinor,comment,openedAt,closedAt,salesCashMinor,salesCardMinor,refundsCashMinor,refundsCardMinor. Даты UTC ISO. Расхождение = actual − expected. Ожидаемые наличные = opening + cash sales − cash refunds. Отрицательный ожидаемый итог допустим, если выплата превысила зарегистрированные наличные; отрицательный ввод фактической суммы запрещён. Все итоги должны оставаться безопасными целыми.

Одна касса и одна открытая смена на магазин. Автор проводит в ней продажи. Владелец может закрыть чужую смену, но не продавать от её автора. Продажа/возврат/закрытие блокируют строку смены; после закрытия новые операции запрещены.

## Кассовая продажа

POST /shops/:shopId/pos/sales

```json
{
  "shiftId": "UUID",
  "method": "cash",
  "lines": [
    { "variantId": "UUID", "quantity": 2, "expectedUnitPriceMinor": 15000 }
  ]
}
```

method: cash|card, 1..100 уникальных вариантов, quantity 1..1000000000. Ответ: {id,kind:"sale",totalMinor,shiftId,method}. Товарное списание и запись оплаты атомарны. Это отметка получения денег, не банковская транзакция и не фискальный чек.

GET .../pos/sales?page=1&pageSize=25 → {items,total,page,pageSize}. Владелец видит магазин; остальные — собственные продажи. GET .../pos/sales/:id возвращает снимки позиций с id,variantId,name,barcode,quantity,returnedQuantity,unitPriceMinor. Себестоимость отсутствует. Старые продажи без смены имеют shiftId:null,method:null и не входят в денежные итоги.

## Возврат

POST /shops/:shopId/pos/returns, владелец или сотрудник с canReturn:

```json
{
  "saleId": "UUID",
  "shiftId": "UUID",
  "method": "cash",
  "refundMoney": true,
  "reason": "Не подошёл размер",
  "lines": [{ "saleLineId": "UUID", "quantity": 1, "condition": "resellable" }]
}
```

condition: resellable|defective. Уникальные saleLineId, 1..100 строк; количество не превышает ещё не возвращённое. При refundMoney=true требуется собственная открытая смена и method; исходная продажа должна иметь запись оплаты. При false shiftId/method запрещены. Старые продажи допускают только false.

Ответ: {id,kind:"return",totalMinor,refundedMinor}. totalMinor — сумма по историческим ценам, refundedMinor=0 для товарного возврата без выплаты. Частичный возврат восстанавливает разницу накопительно округлённой исторической себестоимости. Брак расходует лимит возврата, но не увеличивает доступные остатки; сохранён в return_lines. Деньги сотрудник возвращает самостоятельно. Последующая отдельная выплата по уже выполненному товарному возврату в этот этап не входит.

## Повторы и ошибки

Идемпотентность общая по магазину. Новые операции включают сотрудника в отпечаток. Другой сотрудник с тем же ключом получает409. Повтор точно прежних данных возвращает результат, включая уже закрытую смену. Неизвестный результат повторяется с тем же ключом, URL и телом; менять его нельзя.

400 — поля/суммы/комментарий;401 — сессия;403 — права/Origin/CSRF;404 — чужая или отсутствующая сущность;409 — занятая/закрытая смена, конфликт ключа, цена, остаток, превышение возврата или неизвестная старая оплата;429 — лимит входа. 5xx/потеря ответа считаются неизвестным результатом.

## Дополнительные разрешения сотрудников

`POST /shops/:shopId/staff/:userId/permissions` принимает `{canReturn:boolean,canViewReports:boolean}`. Оба поля обязательны. Требуется владелец магазина, UUID `Idempotency-Key`, а для cookie также Origin/CSRF. Изменение владельца запрещено. Смена прав, аудит `staff:permissions` (before/after) и результат повтора сохраняются атомарно. Неизменённые права не создают аудит. Повтор старого ключа после последующего отзыва возвращает прежний ответ, но не выдаёт права заново.

`GET /auth/me`, `GET /shops/:shopId/access` и список сотрудников возвращают эффективные `canReturn`/`canViewReports`; для владельца оба true. `access?permission=return|reports` проверяет соответствующее разрешение. Смена роли сбрасывает оба дополнительных разрешения; приглашение не выдаёт их автоматически.

`canReturn` открывает историю/детали продаж магазина и возвраты без себестоимости. `canViewReports` открывает финансовую сводку, CSV-экспорт и историю продаж магазина, а кассиру также стоимость остатка. Эти разрешения независимы; они не выдают права управления персоналом, каталогом или чужими сменами. Без обоих разрешений сотруднику доступна только собственная история продаж. Права на возврат повторно проверяются внутри транзакции до блокировки смены и остатков; отзыв блокирует также повтор ранее завершённого запроса.
