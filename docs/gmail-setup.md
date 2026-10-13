# Gmail API без отдельного worker

MyStore может отправлять письма через Gmail по HTTPS и обрабатывать очередь внутри существующего API. Отдельный Render Background Worker не требуется. SMTP остаётся альтернативой.

## Ограничения бесплатного Render

Текущий сервис MyStore — Free. Render блокирует обычные SMTP-порты 25/465/587 на Free web services. Gmail API использует HTTPS. Бесплатный сервис засыпает после периода без входящего трафика: во сне очередь не обрабатывается, после пробуждения продолжается. Не обещайте непрерывную доставку и не используйте искусственные keep-alive запросы как обход тарифа.

Источник: [Render Free](https://render.com/docs/free).

## Google: однократное разрешение отправки

Для отправки из вашего Gmail нужен OAuth client вашего проекта Google Cloud и refresh token, выданный вашему аккаунту. Пароль приложения Gmail здесь не используется. Достаточно scope `https://www.googleapis.com/auth/gmail.send`: приложение не должно запрашивать чтение/удаление вашей почты.

1. В Google Cloud создайте отдельный проект для MyStore или выберите предназначенный для него проект. Включите Gmail API. Не меняйте OAuth-настройки другого приложения.
2. Настройте Google Auth Platform (имя приложения, контактную почту и audience) для своего аккаунта. Добавьте единственный scope gmail.send и свою почту как разрешённого пользователя, если используете Testing.
3. Создайте OAuth client типа Web application. Для первоначального получения токена через официальный OAuth Playground добавьте redirect URI `https://developers.google.com/oauthplayground`.
4. Откройте [OAuth Playground](https://developers.google.com/oauthplayground), включите «Use your own OAuth credentials», введите свой client ID и client secret, запросите только gmail.send. Подтвердите разрешение именно для своей почты и своего приложения, затем обменяйте authorization code на tokens.
5. Сохраните client ID, client secret и refresh token в секретах Render. Не отправляйте их в чат, не коммитьте в Git и не используйте чужие OAuth clients.

Клиент и разрешение создаёт владелец аккаунта. Приложение само не предоставляет себе доступ к Gmail. Не подключайте billing или платные сервисы ради этой отправки.

В режиме External/Testing refresh token для Gmail истекает через 7 дней. Для длительной работы используйте корректно настроенный Production publishing status и выполните требования Google к вашему приложению; не обходите проверки доступа. Токен также может быть отозван пользователем или стать недействительным после смены пароля. Тогда выдайте новое разрешение и замените секрет в Render.

Источники: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [OAuth refresh token expiration](https://developers.google.com/identity/protocols/oauth2#expiration), [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending).

## Переменные существующего сервиса Render

В сервисе `mystore` установите:

| Переменная                 | Значение                                                          |
| -------------------------- | ----------------------------------------------------------------- |
| EMAIL_PROVIDER             | `gmail`                                                           |
| EMAIL_WORKER_MODE          | `inline`                                                          |
| EMAIL_ENABLED              | `true` после подключения остальных настроек                       |
| PUBLIC_BASE_URL            | `https://mystore-dc70.onrender.com` или ваш основной HTTPS origin |
| GMAIL_FROM                 | Gmail аккаунта, которому вы выдали разрешение                     |
| GMAIL_CLIENT_ID            | ID вашего OAuth client                                            |
| GMAIL_CLIENT_SECRET        | Секрет OAuth client                                               |
| GMAIL_REFRESH_TOKEN        | Refresh token с scope gmail.send                                  |
| EMAIL_TOKEN_ENCRYPTION_KEY | 32 случайных байта в base64, стабильный ключ для очереди          |

DATABASE_URL и SESSION_SECRET остаются прежними. Сгенерировать новый ключ можно командой из `docs/email-setup.md`. Не ротируйте существующий ключ при неотправленных зашифрованных ссылках.

Сначала выпустите код, примените миграцию, внесите секреты и только затем включите EMAIL_ENABLED. При неправильной настройке inline-отправка отключается с безопасной диагностикой, API и касса продолжают работать. Отдельную команду worker при inline запускать не нужно. После перезапуска API опрашивает очередь каждые 5 секунд; общий таймаут отправки — 30 секунд, включая получение access token.

Рекомендуемый запас времени для штатной остановки web service — maxShutdownDelaySeconds=60. При принудительном завершении незавершённая доставка возвращается после окончания lease; возможен дубль с прежним Message-ID, но очередь не теряет запись.

## Проверка подключения

Откройте «Уведомления» и проверьте конфигурацию Gmail. Выдайте контрольное приглашение на свою почту и проверьте папку «Спам», ссылку и статус отправки. «Принято Gmail» означает, что Gmail API принял сообщение, а не гарантированную доставку во входящие. Лимиты вашего Gmail и Google API продолжают действовать.

Локальные тесты проверяют формирование MIME/base64url, OAuth refresh, ошибочные ответы без утечки секретов, очередь, конкурентные ticks и compiled API inline. Google endpoints в тестовом процессе заменены контролируемыми ответами; тесты не отправляют письма реальным аккаунтам. Проверка конкретного аккаунта выполняется только после его OAuth-разрешения.
