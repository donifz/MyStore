import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  formatKyrgyzPhoneInput,
  KYRGYZ_PHONE_PATTERN,
} from './kyrgyzPhoneMask';
import { parseBuyerInviteFragment } from './buyerInviteLink';
import BuyerInviteQr from './BuyerInviteQr';
import PaymentIcon from '../pos/PaymentIcon';
import { formatSom } from '../api/money';

type BuyerDebt = {
  saleId: string;
  shopId: string;
  shopName: string;
  totalMinor: number;
  paidMinor: number;
  debtMinor: number;
  dueOn: string;
};

type BuyerRepayment = {
  id: string;
  saleId: string;
  shopId: string;
  shopName: string;
  amountMinor: number;
  method: 'cash' | 'card';
  createdAt: string;
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

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

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
  const [repayments, setRepayments] = useState<BuyerRepayment[]>([]);
  const [debtsError, setDebtsError] = useState('');
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyWallets, setLoyaltyWallets] = useState<
    { shopId: string; shopName: string; balancePoints: number }[]
  >([]);
  const [loyaltyCode, setLoyaltyCode] = useState('');
  const [loyaltyError, setLoyaltyError] = useState('');
  const [loyaltyBusy, setLoyaltyBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState(() =>
    parseBuyerInviteFragment(window.location.hash),
  );
  useEffect(() => {
    if (parseBuyerInviteFragment(window.location.hash)) {
      window.history.replaceState(
        window.history.state,
        '',
        window.location.pathname + window.location.search,
      );
    }
  }, []);
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

  useEffect(() => {
    if (!account) {
      setRepayments([]);
      return;
    }
    let live = true;
    void buyerApi<BuyerRepayment[]>('repayments')
      .then((rows) => {
        if (live) setRepayments(rows);
      })
      .catch(() => {
        if (live) setRepayments([]);
      });
    return () => {
      live = false;
    };
  }, [account?.id, account?.shops.length]);

  useEffect(() => {
    if (!account) {
      setLoyaltyWallets([]);
      setLoyaltyEnabled(false);
      setLoyaltyCode('');
      return;
    }
    let live = true;
    void buyerApi<{ enabled: boolean }>('loyalty/config')
      .then(async (result) => {
        if (!live) return;
        setLoyaltyEnabled(result.enabled);
        if (result.enabled) {
          const wallets =
            await buyerApi<
              { shopId: string; shopName: string; balancePoints: number }[]
            >('loyalty/wallets');
          if (live) setLoyaltyWallets(wallets);
        }
      })
      .catch(() => {
        if (live) setLoyaltyError('Не удалось загрузить бонусы.');
      });
    return () => {
      live = false;
    };
  }, [account?.id, account?.shops.length]);

  const showLoyaltyQr = useCallback(async () => {
    if (!account || loyaltyBusy) return;
    setLoyaltyBusy(true);
    setLoyaltyError('');
    try {
      const code = await buyerApi<{ token: string }>(
        'loyalty/qr',
        {},
        account.csrfToken,
      );
      setLoyaltyCode(code.token);
      setTimeLeft(120);
    } catch (err) {
      setLoyaltyCode('');
      setLoyaltyError(
        err instanceof Error ? err.message : 'Ошибка генерации QR',
      );
    } finally {
      setLoyaltyBusy(false);
    }
  }, [account, loyaltyBusy]);

  // Auto-generate QR code immediately when verified
  useEffect(() => {
    if (
      account?.phoneVerified &&
      loyaltyEnabled &&
      !loyaltyCode &&
      !loyaltyBusy
    ) {
      void showLoyaltyQr();
    }
  }, [
    account?.phoneVerified,
    loyaltyEnabled,
    loyaltyCode,
    loyaltyBusy,
    showLoyaltyQr,
  ]);

  // Countdown timer for single-use QR token
  useEffect(() => {
    if (!loyaltyCode) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loyaltyCode]);

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

  async function linkShop(token: string) {
    if (!account || !token) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const linked = await buyerApi<{ shopName: string }>(
        'link-shop',
        { token: token.trim() },
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

  const totalDebtMinor = debts.reduce((sum, d) => sum + d.debtMinor, 0);
  const totalPoints = loyaltyWallets.reduce(
    (sum, w) => sum + w.balancePoints,
    0,
  );
  const initialLetter = (account?.name?.trim() || 'П')[0].toUpperCase();
  const formattedPhone = account?.phone
    ? formatKyrgyzPhoneInput(account.phone)
    : '';

  return (
    <main className="buyer-page">
      <header className="buyer-topbar">
        <Link to="/" className="buyer-brand">
          <PaymentIcon name="sparkle" size={20} />
          MyStore
        </Link>
        <nav className="buyer-topbar-nav">
          <Link to="/shops" className="buyer-topbar-link">
            Каталог магазинов
          </Link>
          {account && (
            <button
              type="button"
              className="buyer-logout-btn"
              disabled={busy}
              onClick={() => void logout()}
            >
              Выйти
            </button>
          )}
        </nav>
      </header>

      <div className="buyer-container">
        {loading ? (
          <p role="status">Загружаем кабинет…</p>
        ) : account ? (
          <>
            {/* User Profile Header */}
            <section className="buyer-profile-card">
              <div className="buyer-profile-info">
                <div className="buyer-avatar" aria-hidden="true">
                  {initialLetter}
                </div>
                <div className="buyer-profile-details">
                  <p className="eyebrow">Личный кабинет покупателя</p>
                  <h1>Здравствуйте, {account.name}!</h1>
                  <div className="buyer-profile-meta">
                    <span className="buyer-phone-badge">{formattedPhone}</span>
                    {account.phoneVerified ? (
                      <span className="buyer-status-pill verified">
                        <PaymentIcon name="check" size={14} />
                        Телефон подтверждён
                      </span>
                    ) : (
                      <span className="buyer-status-pill unverified">
                        <PaymentIcon name="clock" size={14} />
                        Требуется подтверждение
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Telegram verification warning */}
            {!account.phoneVerified && (
              <div className="buyer-message" role="status">
                <strong>Номер ещё не подтверждён</strong>
                <p>
                  Для активации персонального QR-кода лояльности и начисления
                  бонусов подтвердите свой номер через Telegram.
                </p>
              </div>
            )}

            {!account.phoneVerified && telegramEnabled && (
              <section className="buyer-telegram-card">
                <div className="buyer-telegram-header">
                  <div className="buyer-telegram-icon" aria-hidden="true">
                    <PaymentIcon name="sparkle" size={22} />
                  </div>
                  <div>
                    <h2>Подтвердить телефон через Telegram</h2>
                    <p>
                      Нажмите кнопку, затем в боте Telegram поделитесь своим
                      контактом. Номер контакта должен совпадать с номером
                      кабинета. Ссылка действует 10 минут.
                    </p>
                  </div>
                </div>
                <div className="buyer-telegram-actions">
                  <button
                    type="button"
                    className="button primary"
                    disabled={busy}
                    onClick={() => void prepareTelegram()}
                  >
                    Получить ссылку для подтверждения
                  </button>
                  {telegramLink && (
                    <a
                      href={telegramLink}
                      className="button secondary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Открыть Telegram-бота
                    </a>
                  )}
                  <button
                    type="button"
                    className="button"
                    onClick={() => void refresh()}
                  >
                    Проверить статус номера
                  </button>
                </div>
                {telegramError && (
                  <p role="alert" className="error">
                    {telegramError}
                  </p>
                )}
              </section>
            )}

            {/* Hero Loyalty Card with Embedded QR Code */}
            {loyaltyEnabled && (
              <section className="buyer-loyalty-hero">
                <div className="buyer-loyalty-sheen" aria-hidden="true" />
                <div className="buyer-loyalty-top">
                  <span className="buyer-loyalty-badge">
                    <PaymentIcon name="sparkle" size={14} />
                    MyStore Club
                  </span>
                  <PaymentIcon name="wallet" size={24} />
                </div>

                <div className="buyer-loyalty-balance-box">
                  <span className="buyer-loyalty-label">Баланс бонусов</span>
                  <div className="buyer-loyalty-points">
                    {totalPoints.toLocaleString('ru-RU')}
                    <small>баллов</small>
                  </div>
                  <span className="buyer-loyalty-rate">
                    1 балл = 1 сом скидки · Предъявите QR кассиру
                  </span>
                </div>

                {/* Embedded QR right in the green card */}
                {account.phoneVerified ? (
                  <div className="buyer-hero-qr-container">
                    {loyaltyBusy && !loyaltyCode ? (
                      <div className="buyer-hero-qr-placeholder">
                        <PaymentIcon name="sparkle" size={28} />
                        <span>Генерируем ваш QR-код…</span>
                      </div>
                    ) : loyaltyCode ? (
                      <div className="buyer-hero-qr-box">
                        <div className="buyer-hero-qr-img buyer-invite-panel">
                          <BuyerInviteQr value={loyaltyCode} />
                        </div>
                        <div className="buyer-hero-qr-meta">
                          <span className="buyer-qr-timer">
                            <PaymentIcon name="clock" size={13} />
                            {timeLeft > 0
                              ? `Действует: ${formatTimer(timeLeft)}`
                              : 'Код истёк'}
                          </span>
                          <button
                            type="button"
                            className="buyer-qr-refresh-link"
                            disabled={loyaltyBusy}
                            onClick={() => void showLoyaltyQr()}
                          >
                            <PaymentIcon name="sparkle" size={13} />
                            Обновить QR
                          </button>
                        </div>
                        <p className="buyer-hero-qr-hint">
                          Покажите этот код кассиру любого магазина для
                          начисления или списания бонусов
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="buyer-loyalty-unverified-cta">
                    <PaymentIcon name="clock" size={22} />
                    <p>
                      Подтвердите телефон через Telegram, чтобы активировать
                      персональный QR-код.
                    </p>
                  </div>
                )}

                {loyaltyWallets.length > 0 && (
                  <div className="buyer-loyalty-wallets-list">
                    {loyaltyWallets.map((wallet) => (
                      <span className="buyer-wallet-pill" key={wallet.shopId}>
                        {wallet.shopName}:{' '}
                        <strong>{wallet.balancePoints} баллов</strong>
                      </span>
                    ))}
                  </div>
                )}

                {loyaltyError && (
                  <p
                    role="alert"
                    style={{ color: '#fca5a5', marginTop: '10px' }}
                  >
                    {loyaltyError}
                  </p>
                )}
              </section>
            )}

            {/* Quick Stats Overview */}
            <div className="buyer-stats-grid">
              <div className="buyer-stat-tile">
                <div className="buyer-stat-icon emerald">
                  <PaymentIcon name="tag" size={22} />
                </div>
                <div className="buyer-stat-body">
                  <span className="buyer-stat-label">Подключено магазинов</span>
                  <span className="buyer-stat-value">
                    {account.shops.length}
                  </span>
                </div>
              </div>

              <div className="buyer-stat-tile">
                <div className="buyer-stat-icon amber">
                  <PaymentIcon name="clock" size={22} />
                </div>
                <div className="buyer-stat-body">
                  <span className="buyer-stat-label">Остаток долга</span>
                  <span className="buyer-stat-value">
                    {totalDebtMinor === 0
                      ? '0,00 сом'
                      : formatSom(totalDebtMinor)}
                  </span>
                </div>
              </div>

              <div className="buyer-stat-tile">
                <div className="buyer-stat-icon blue">
                  <PaymentIcon name="check" size={22} />
                </div>
                <div className="buyer-stat-body">
                  <span className="buyer-stat-label">Погашений</span>
                  <span className="buyer-stat-value">{repayments.length}</span>
                </div>
              </div>
            </div>

            {/* If an invite token was provided via QR link */}
            {inviteToken && (
              <section
                className="panel buyer-tile"
                style={{ marginBottom: '20px' }}
              >
                <p
                  className="muted"
                  style={{ color: '#065f46', marginBottom: '12px' }}
                >
                  Приглашение из ссылки получено. Нажмите «Подтвердить», чтобы
                  привязать магазин к вашему кабинету.
                </p>
                <button
                  type="button"
                  className="button primary"
                  disabled={busy}
                  onClick={() => void linkShop(inviteToken)}
                >
                  Подтвердить привязку магазина
                </button>
              </section>
            )}

            {/* Main Sections Grid */}
            <div className="buyer-layout-grid">
              {/* Left Column: Debts & Repayments */}
              <div>
                <section className="buyer-panel">
                  <div className="buyer-panel-head">
                    <h2>
                      <PaymentIcon name="clock" size={20} />
                      Мои долги
                    </h2>
                    <span className="muted">
                      Всего осталось:{' '}
                      <strong>{formatSom(totalDebtMinor)}</strong>
                    </span>
                  </div>

                  {debtsError && (
                    <p role="alert" className="error">
                      {debtsError}
                    </p>
                  )}

                  {!debts.length && !debtsError && (
                    <p className="muted">Задолженностей нет.</p>
                  )}

                  {debts.map((debt) => {
                    const percentPaid =
                      debt.totalMinor > 0
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                (debt.paidMinor / debt.totalMinor) * 100,
                              ),
                            ),
                          )
                        : 100;

                    return (
                      <div key={debt.saleId} className="buyer-debt-card">
                        <div className="buyer-debt-card-top">
                          <strong className="buyer-debt-shop">
                            {debt.shopName}
                          </strong>
                          <span className="buyer-debt-amount">
                            {formatSom(debt.debtMinor)}
                          </span>
                        </div>

                        <div
                          className="buyer-progress-track"
                          title={`Выплачено ${percentPaid}%`}
                        >
                          <div
                            className="buyer-progress-fill"
                            style={{ width: `${percentPaid}%` }}
                          />
                        </div>

                        <div className="buyer-debt-meta">
                          <span>
                            Оплачено {formatSom(debt.paidMinor)} из{' '}
                            {formatSom(debt.totalMinor)}
                          </span>
                          <span className="buyer-due-badge">
                            Погасить до: {debt.dueOn}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </section>

                <section className="buyer-panel">
                  <div className="buyer-panel-head">
                    <h2>
                      <PaymentIcon name="card" size={20} />
                      История погашений
                    </h2>
                  </div>

                  {!repayments.length && (
                    <p className="muted">Платежей пока нет.</p>
                  )}

                  {repayments.map((payment) => (
                    <div key={payment.id} className="buyer-repayment-item">
                      <div className="buyer-repayment-info">
                        <div
                          className="buyer-repayment-icon"
                          title={
                            payment.method === 'card'
                              ? 'Безналичная оплата'
                              : 'Наличный платёж'
                          }
                        >
                          <PaymentIcon
                            name={payment.method === 'card' ? 'card' : 'cash'}
                            size={16}
                          />
                        </div>
                        <div>
                          <strong>{payment.shopName}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {new Date(payment.createdAt).toLocaleDateString(
                              'ru-KG',
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="buyer-repayment-amount">
                        +{formatSom(payment.amountMinor)}
                      </span>
                    </div>
                  ))}
                </section>
              </div>

              {/* Right Column: Connected Shops */}
              <div>
                <section className="buyer-panel">
                  <div className="buyer-panel-head">
                    <h2>
                      <PaymentIcon name="tag" size={20} />
                      Мои магазины
                    </h2>
                  </div>

                  {account.shops.length > 0 ? (
                    <div>
                      {account.shops.map((s) => (
                        <span key={s.shopId} className="buyer-shop-chip">
                          <PaymentIcon name="check" size={14} />
                          {s.shopName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">
                      Подключённые магазины появятся после первой покупки или
                      сканирования QR на кассе.
                    </p>
                  )}
                </section>
              </div>
            </div>
          </>
        ) : (
          /* Authentication Screen */
          <section className="buyer-auth-card">
            <div className="buyer-auth-head">
              <p className="eyebrow">MyStore · Покупателям</p>
              <h1>
                {mode === 'register' ? 'Создать аккаунт' : 'Войти в кабинет'}
              </h1>
              {inviteToken && (
                <div className="buyer-message" role="status">
                  Приглашение магазина получено. Войдите или зарегистрируйтесь
                  со своим номером и подтвердите привязку.
                </div>
              )}
              <p className="muted">
                Один кабинет для покупок в магазинах MyStore. Вход по номеру
                Кыргызстана и паролю.
              </p>
            </div>

            <form onSubmit={(e) => void submit(e)} className="buyer-auth-form">
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
                  pattern={KYRGYZ_PHONE_PATTERN}
                  title="Номер Кыргызстана: +996 700 123 456"
                  value={phone}
                  onChange={(e) =>
                    setPhone(formatKyrgyzPhoneInput(e.target.value))
                  }
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
              <button
                type="submit"
                className="buyer-submit-btn"
                disabled={busy}
              >
                {busy
                  ? 'Сохраняем…'
                  : mode === 'register'
                    ? 'Зарегистрироваться'
                    : 'Войти'}
              </button>
            </form>

            <button
              type="button"
              className="buyer-toggle-btn"
              onClick={() => {
                setError('');
                setMode(mode === 'register' ? 'login' : 'register');
              }}
            >
              {mode === 'register'
                ? 'Уже есть аккаунт? Войти'
                : 'Нет аккаунта? Регистрация'}
            </button>
            <p
              className="muted"
              style={{
                fontSize: '12px',
                textAlign: 'center',
                marginTop: '16px',
              }}
            >
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
