import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

type BuyerDebt = {
  saleId: string;
  shopId: string;
  shopName: string;
  totalMinor: number;
  paidMinor: number;
  debtMinor: number;
  dueOn: string;
};

type BuyerAccount = {
  id: string;
  phone: string;
  name: string;
  phoneVerified: boolean;
  shops: { shopId: string; shopName: string }[];
  createdAt: string;
  csrfToken: string;
};

async function buyerApi<T>(
  path: string,
  body?: unknown,
  csrfToken?: string,
): Promise<T> {
  const response = await fetch('/api/buyer/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof json?.message === 'string'
        ? json.message
        : Array.isArray(json?.message)
          ? json.message.join(', ')
          : 'Не удалось выполнить запрос',
    );
  }
  return json as T;
}

export default function BuyerPortalPage() {
  const [account, setAccount] = useState<BuyerAccount | null>(null);
  const [debts, setDebts] = useState<BuyerDebt[]>([]);
  const [debtsError, setDebtsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramLink, setTelegramLink] = useState('');
  const [telegramError, setTelegramError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setAccount(await buyerApi<BuyerAccount>('me'));
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!account) {
      setTelegramEnabled(false);
      setTelegramLink('');
      return;
    }
    let active = true;
    void buyerApi<{ enabled: boolean }>('telegram/config')
      .then((result) => {
        if (active) setTelegramEnabled(result.enabled);
      })
      .catch(() => {
        if (active) setTelegramEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [account?.id, account?.phoneVerified]);

  async function prepareTelegram() {
    setBusy(true);
    setTelegramError('');
    setTelegramLink('');
    try {
      const result = await buyerApi<{ url: string }>(
        'telegram/start',
        {},
        account?.csrfToken,
      );
      setTelegramLink(result.url);
    } catch (err) {
      setTelegramError(
        err instanceof Error ? err.message : 'Ошибка подтверждения',
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!account) {
      setDebts([]);
      return;
    }
    let alive = true;
    void buyerApi<BuyerDebt[]>('debts')
      .then((items) => {
        if (alive) {
          setDebts(items);
          setDebtsError('');
        }
      })
      .catch(() => {
        if (alive) setDebtsError('Не удалось загрузить долги.');
      });
    return () => {
      alive = false;
    };
  }, [account?.id, account?.shops.length]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'register') {
        await buyerApi('register', { phone, name, password });
      }
      await buyerApi('login', { phone, password });
      setPassword('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setBusy(false);
    }
  }

  async function linkShop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!account) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const linked = await buyerApi<{ shopName: string }>(
        'link-shop',
        { token: inviteToken.trim() },
        account.csrfToken,
      );
      setInviteToken('');
      setNotice('Магазин «' + linked.shopName + '» привязан к кабинету.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Код недействителен');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!account) return;
    setBusy(true);
    setError('');
    try {
      await buyerApi('logout', {}, account.csrfToken);
      setAccount(null);
      setNotice('Вы вышли из кабинета.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выйти');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="buyer-page">
      <header className="buyer-topbar">
        <Link to="/" className="buyer-brand">
          MyStore
        </Link>
        <Link to="/shops">Каталог магазинов</Link>
      </header>
      <div className="buyer-container">
        {loading ? (
          <p role="status">Загружаем кабинет…</p>
        ) : account ? (
          <>
            <div className="buyer-heading">
              <div>
                <p className="eyebrow">Личный кабинет покупателя</p>
                <h1>Здравствуйте, {account.name}!</h1>
                <p className="muted">{account.phone}</p>
              </div>
              <button disabled={busy} onClick={() => void logout()}>
                Выйти
              </button>
            </div>
            {!account.phoneVerified && (
              <div className="buyer-message" role="status">
                <strong>Номер ещё не подтверждён</strong>
                <p>
                  Номер ещё не подтверждён через Telegram. Связать кабинет с
                  конкретным магазином можно только по одноразовому коду,
                  полученному лично у кассира. Знание телефона недостаточно.
                </p>
              </div>
            )}
            {!account.phoneVerified && telegramEnabled && (
              <section className="panel buyer-tile">
                <h2>Подтвердить телефон через Telegram</h2>
                <p className="muted">
                  Нажмите кнопку, затем в боте Telegram поделитесь своим
                  контактом. Номер контакта должен совпадать с номером кабинета.
                  Ссылка действует 10 минут.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void prepareTelegram()}
                >
                  Получить ссылку для подтверждения
                </button>
                {telegramLink && (
                  <p>
                    <a
                      href={telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Открыть Telegram-бота
                    </a>
                  </p>
                )}
                {telegramError && (
                  <p role="alert" className="error">
                    {telegramError}
                  </p>
                )}
                <button type="button" onClick={() => void refresh()}>
                  Проверить статус номера
                </button>
              </section>
            )}
            <section className="panel buyer-tile">
              <h2>Привязать магазин</h2>
              <p className="muted">
                Получите одноразовый код у кассира и введите его здесь. Код
                действует 15 минут.
              </p>
              <form onSubmit={(e) => void linkShop(e)}>
                <label>
                  Код приглашения
                  <input
                    required
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="Код от кассира"
                    maxLength={43}
                  />
                </label>
                <button
                  type="submit"
                  className="primary"
                  disabled={busy || inviteToken.trim().length !== 43}
                >
                  Привязать магазин
                </button>
              </form>
            </section>
            <div className="buyer-grid">
              <section className="panel buyer-tile">
                <h2>Мои магазины</h2>
                <p className="muted">
                  {account.shops.length
                    ? account.shops.map((s) => s.shopName).join(', ')
                    : 'Подключённые магазины появятся после безопасной привязки аккаунта.'}
                </p>
              </section>
              <section className="panel buyer-tile">
                <h2>Мои долги</h2>
                <p className="muted">
                  Всего осталось:{' '}
                  <strong>
                    {(
                      debts.reduce((sum, debt) => sum + debt.debtMinor, 0) / 100
                    ).toLocaleString('ru-RU')}{' '}
                    сом
                  </strong>
                </p>
                {debtsError && (
                  <p role="alert" className="error">
                    {debtsError}
                  </p>
                )}
                {!debts.length && !debtsError && (
                  <p className="muted">Задолженностей нет.</p>
                )}
                {debts.map((debt) => (
                  <div key={debt.saleId} className="buyer-debt-row">
                    <strong>{debt.shopName}</strong>
                    <span>
                      {(debt.debtMinor / 100).toLocaleString('ru-RU')} сом
                    </span>
                    <small>Погасить до: {debt.dueOn}</small>
                  </div>
                ))}
              </section>
              <section className="panel buyer-tile">
                <h2>Акции и бонусы</h2>
                <p className="muted">
                  Акции магазинов и персональные бонусы будут добавлены в
                  отдельном этапе. Баллы разных магазинов не смешиваются.
                </p>
              </section>
            </div>
          </>
        ) : (
          <section className="panel buyer-auth">
            <p className="eyebrow">MyStore · Покупателям</p>
            <h1>
              {mode === 'register' ? 'Создать аккаунт' : 'Войти в кабинет'}
            </h1>
            <p className="muted">
              Один кабинет для покупок в магазинах MyStore. Вход по номеру
              Кыргызстана и паролю.
            </p>
            <form onSubmit={(e) => void submit(e)}>
              {mode === 'register' && (
                <label>
                  Ваше имя
                  <input
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Азамат"
                  />
                </label>
              )}
              <label>
                Номер телефона
                <input
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={32}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+996 700 123 456"
                />
              </label>
              <label>
                Пароль
                <input
                  type="password"
                  autoComplete={
                    mode === 'register' ? 'new-password' : 'current-password'
                  }
                  required
                  minLength={mode === 'register' ? 12 : 1}
                  maxLength={256}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Не менее 12 символов"
                />
              </label>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {notice && <p role="status">{notice}</p>}
              <button type="submit" className="primary" disabled={busy}>
                {busy
                  ? 'Сохраняем…'
                  : mode === 'register'
                    ? 'Зарегистрироваться'
                    : 'Войти'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode(mode === 'register' ? 'login' : 'register');
              }}
            >
              {mode === 'register'
                ? 'Уже есть аккаунт? Войти'
                : 'Нет аккаунта? Регистрация'}
            </button>
            <p className="muted">
              Ввод номера без подтверждения не предоставляет доступ к чужим
              покупкам или персональным данным.
            </p>
          </section>
        )}
        {error && account && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {notice && account && <p role="status">{notice}</p>}
      </div>
    </main>
  );
}
