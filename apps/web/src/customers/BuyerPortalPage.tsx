import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  formatKyrgyzPhoneInput,
  KYRGYZ_PHONE_PATTERN,
} from './kyrgyzPhoneMask';
import {
  parseBuyerInviteFragment,
  parseBuyerAuthTokenFragment,
} from './buyerInviteLink';
import BuyerInviteQr from './BuyerInviteQr';
import PaymentIcon from '../pos/PaymentIcon';
import { formatSom } from '../api/money';

type NavIconName =
  | 'bag'
  | 'home'
  | 'box'
  | 'shop'
  | 'grid'
  | 'star'
  | 'flame'
  | 'heart'
  | 'cart'
  | 'user';

const NAV_ICON_PATHS: Record<NavIconName, string> = {
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0',
  home: 'm3 10 9-7 9 7v11h-7v-7h-4v7H3Z',
  box: 'm3 6 9-4 9 4v12l-9 4-9-4Z m0-12 9 4 9-4 M12 10v12',
  shop: 'M3 9 5 4h14l2 5 M4 9v11h16V9 M9 20v-6h6v6',
  grid: 'M3 3h7v7H3Z M14 3h7v7h-7Z M14 14h7v7h-7Z M3 14h7v7H3Z',
  star: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z',
  flame:
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  cart: 'M3 3h2l3 12h10l3-9H6 M9 20h.01 M18 20h.01',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2 M17 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
};

function NavIcon({ name, size = 18 }: { name: NavIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {NAV_ICON_PATHS[name].split(' M').map((segment, index) => (
        <path key={segment} d={index === 0 ? segment : 'M' + segment} />
      ))}
    </svg>
  );
}

function formatDueDate(value: string): string {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (isoMatch) {
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('ru-KG');
  }
  return value;
}

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

type BuyerPurchase = {
  saleId: string;
  shopId: string;
  shopName: string;
  totalMinor: number;
  createdAt: string;
  method: 'cash' | 'card' | null;
  isCredit: boolean;
  earnedPoints: number;
  spentPoints: number;
  lines: {
    name: string;
    quantity: number;
    unitPriceMinor: number;
    discountMinor: number;
  }[];
};

type BuyerAccount = {
  id: string;
  phone: string;
  name: string;
  phoneVerified: boolean;
  hasInitialPassword?: boolean;
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
  const [purchases, setPurchases] = useState<BuyerPurchase[]>([]);
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
  const [authToken, setAuthToken] = useState(() =>
    parseBuyerAuthTokenFragment(window.location.hash),
  );
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordBusy, setChangePasswordBusy] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');

  const [telegramLoginOpen, setTelegramLoginOpen] = useState(false);
  const [telegramLoginUrl, setTelegramLoginUrl] = useState('');
  const [telegramLoginToken, setTelegramLoginToken] = useState('');
  const [telegramLoginBusy, setTelegramLoginBusy] = useState(false);
  const [telegramLoginError, setTelegramLoginError] = useState('');

  useEffect(() => {
    if (
      parseBuyerInviteFragment(window.location.hash) ||
      parseBuyerAuthTokenFragment(window.location.hash)
    ) {
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

  const handledInviteRef = useRef('');

  useEffect(() => {
    if (!inviteToken) {
      if (!handledInviteRef.current && !authToken) {
        void refresh();
      }
      return;
    }
    if (handledInviteRef.current === inviteToken) {
      return;
    }
    handledInviteRef.current = inviteToken;
    setBusy(true);
    void buyerApi<{ shopName: string; isNewAccount: boolean }>(
      'accept-invite',
      {
        token: inviteToken,
      },
    )
      .then(async (res) => {
        setNotice(`Вы вошли в кабинет! Магазин «${res.shopName}» подключён.`);
        await refresh();
      })
      .catch(async (err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Не удалось войти по приглашению.',
        );
        await refresh();
      })
      .finally(() => {
        setInviteToken('');
        setBusy(false);
      });
  }, [inviteToken, authToken, refresh]);

  const handledAuthRef = useRef('');

  useEffect(() => {
    if (!authToken || handledAuthRef.current === authToken) return;
    handledAuthRef.current = authToken;
    setBusy(true);
    void buyerApi<{ csrfToken: string }>('token-login', { token: authToken })
      .then(async () => {
        setNotice('Вы успешно вошли в кабинет!');
        await refresh();
      })
      .catch(async (err) => {
        setError(
          err instanceof Error ? err.message : 'Не удалось войти по ссылке.',
        );
        await refresh();
      })
      .finally(() => {
        setAuthToken('');
        setBusy(false);
      });
  }, [authToken, refresh]);

  useEffect(() => {
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
  }, [account?.id]);

  useEffect(() => {
    if (!telegramLoginToken || !telegramLoginOpen) return;
    let active = true;
    const interval = setInterval(() => {
      void buyerApi<{ status: string; csrfToken?: string }>(
        'telegram/auth-poll',
        { token: telegramLoginToken },
      )
        .then(async (res) => {
          if (!active) return;
          if (res.status === 'ready') {
            clearInterval(interval);
            setTelegramLoginOpen(false);
            setTelegramLoginToken('');
            setNotice('Вы успешно вошли в кабинет через Telegram!');
            await refresh();
          } else if (res.status === 'expired') {
            clearInterval(interval);
            setTelegramLoginError('Время ожидания истекло. Повторите попытку.');
          }
        })
        .catch(() => {});
    }, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [telegramLoginToken, telegramLoginOpen, refresh]);

  async function startTelegramLogin() {
    setTelegramLoginError('');
    setTelegramLoginBusy(true);
    try {
      const res = await buyerApi<{ url: string; token: string }>(
        'telegram/auth-request',
        {},
      );
      setTelegramLoginUrl(res.url);
      setTelegramLoginToken(res.token);
      setTelegramLoginOpen(true);
    } catch (err) {
      setTelegramLoginError(
        err instanceof Error
          ? err.message
          : 'Не удалось запустить вход через Telegram',
      );
    } finally {
      setTelegramLoginBusy(false);
    }
  }

  async function submitChangePassword(e: FormEvent) {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');
    if (newPassword.length < 12) {
      setChangePasswordError('Пароль должен содержать не менее 12 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError('Пароли не совпадают');
      return;
    }
    setChangePasswordBusy(true);
    try {
      await buyerApi(
        'change-password',
        { password: newPassword },
        account?.csrfToken,
      );
      setChangePasswordSuccess('Пароль успешно сохранён!');
      setNewPassword('');
      setConfirmPassword('');
      setShowChangePassword(false);
      setRevealedPassword(null);
      await refresh();
    } catch (err) {
      setChangePasswordError(
        err instanceof Error ? err.message : 'Не удалось изменить пароль',
      );
    } finally {
      setChangePasswordBusy(false);
    }
  }

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
      setPurchases([]);
      return;
    }
    let live = true;
    void buyerApi<BuyerPurchase[]>('loyalty/purchases')
      .then((rows) => {
        if (live) setPurchases(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (live) setPurchases([]);
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
      setRevealedPassword(null);
      setPasswordVisible(false);
      setNotice('Вы вышли из кабинета.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выйти');
    } finally {
      setBusy(false);
    }
  }

  async function togglePasswordVisibility() {
    if (passwordVisible) {
      setPasswordVisible(false);
      return;
    }
    if (revealedPassword) {
      setPasswordVisible(true);
      return;
    }
    setPasswordBusy(true);
    setError('');
    try {
      const result = await buyerApi<{ password: string | null }>(
        'initial-password',
      );
      if (result.password) {
        setRevealedPassword(result.password);
        setPasswordVisible(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось получить пароль',
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  async function copyPassword() {
    if (!revealedPassword) return;
    try {
      await navigator.clipboard.writeText(revealedPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать пароль');
    }
  }

  const totalDebtMinor = debts.reduce((sum, d) => sum + d.debtMinor, 0);
  const formattedPhone = account?.phone
    ? formatKyrgyzPhoneInput(account.phone)
    : '';

  return (
    <div className="buyer-page">
      <header className="buyer-topbar">
        <div className="buyer-topbar__inner">
          <a href="/" className="buyer-brand">
            <span className="buyer-brand__mark" aria-hidden="true">
              <NavIcon name="bag" size={20} />
            </span>
            <span>MyStore</span>
          </a>

          <nav className="buyer-top-nav" aria-label="Разделы витрины">
            <a href="/" className="buyer-top-nav__item">
              <NavIcon name="home" size={16} />
              <span>Главная</span>
            </a>
            <a href="/shops" className="buyer-top-nav__item">
              <NavIcon name="box" size={16} />
              <span>Магазины</span>
            </a>
            <a href="/catalog" className="buyer-top-nav__item">
              <NavIcon name="grid" size={16} />
              <span>Каталог</span>
            </a>
            <a href="/?sort=price-asc#catalog" className="buyer-top-nav__item">
              <NavIcon name="star" size={16} />
              <span>Акции</span>
            </a>
            <a href="/?sort=newest#catalog" className="buyer-top-nav__item">
              <NavIcon name="flame" size={16} />
              <span>Новинки</span>
            </a>
          </nav>

          <div className="buyer-topbar-actions">
            <a
              href="/favorites"
              className="buyer-header-icon-btn"
              aria-label="Избранное"
              title="Избранное"
            >
              <NavIcon name="heart" size={19} />
            </a>
            <a
              href="/cart"
              className="buyer-header-icon-btn"
              aria-label="Корзина"
              title="Корзина"
            >
              <NavIcon name="cart" size={19} />
            </a>
            <a
              href="/buyer"
              className="buyer-header-icon-btn buyer-header-icon-btn--active"
              aria-label="Профиль"
              aria-current="page"
              title="Профиль"
            >
              <NavIcon name="user" size={19} />
            </a>
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
          </div>
        </div>
      </header>

      <main className="buyer-container">
        {loading ? (
          <p role="status">Загружаем кабинет…</p>
        ) : account ? (
          <>
            {/* User Profile Header */}
            <section className="buyer-profile-card">
              <div className="buyer-profile-info">
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
                  <p role="alert" className="buyer-loyalty-error">
                    {loyaltyError}
                  </p>
                )}
              </section>
            )}

            {/* Quick Stats Overview */}
            <div className="buyer-stats-grid">
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
                  style={{ color: '#1d4ed8', marginBottom: '12px' }}
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
              {/* Left Column: Purchases, Debts & Repayments */}
              <div>
                <section
                  className="buyer-panel"
                  style={{ marginBottom: '20px' }}
                >
                  <div className="buyer-panel-head">
                    <h2>
                      <NavIcon name="bag" size={20} />
                      Мои покупки
                    </h2>
                    <span className="muted">{purchases.length} чек.</span>
                  </div>

                  {!purchases.length && (
                    <p className="muted">
                      Покупок на кассе с картой или в долг пока нет.
                    </p>
                  )}

                  {purchases.map((purchase) => (
                    <div
                      key={purchase.saleId}
                      className="buyer-debt-item"
                      style={{ marginBottom: '12px' }}
                    >
                      <div className="buyer-debt-top">
                        <div>
                          <div className="buyer-debt-shop">
                            {purchase.shopName}
                          </div>
                          <div className="buyer-debt-id">
                            Чек #{purchase.saleId.slice(0, 8).toUpperCase()} ·{' '}
                            {new Date(purchase.createdAt).toLocaleString(
                              'ru-KG',
                              {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}
                          </div>
                        </div>
                        <span className="buyer-debt-amount">
                          {formatSom(purchase.totalMinor)}
                        </span>
                      </div>

                      {purchase.lines.length > 0 && (
                        <ul
                          style={{
                            margin: '8px 0',
                            paddingLeft: '16px',
                            fontSize: '13px',
                            color: '#334155',
                          }}
                        >
                          {purchase.lines.map((line, index) => (
                            <li key={index}>
                              {line.name} × {line.quantity} —{' '}
                              {formatSom(
                                line.quantity *
                                  (line.unitPriceMinor - line.discountMinor),
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="buyer-debt-meta">
                        <span>
                          {purchase.isCredit
                            ? 'В долг'
                            : purchase.method === 'card'
                              ? 'Карта / QR'
                              : purchase.method === 'cash'
                                ? 'Наличные'
                                : 'Оплата'}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                          }}
                        >
                          {purchase.earnedPoints > 0 && (
                            <span
                              className="buyer-due-badge"
                              style={{
                                background: '#e8f5ee',
                                color: '#176b4a',
                              }}
                            >
                              +{purchase.earnedPoints} б.
                            </span>
                          )}
                          {purchase.spentPoints > 0 && (
                            <span className="buyer-due-badge">
                              −{purchase.spentPoints} б.
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </section>

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
                            Погасить до: {formatDueDate(debt.dueOn)}
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

              {/* Right Column: Password & Connected Shops */}
              <div>
                <section
                  className="buyer-panel"
                  style={{ marginBottom: '20px' }}
                >
                  <div className="buyer-panel-head">
                    <h2>Пароль для входа</h2>
                  </div>
                  {account.hasInitialPassword && (
                    <>
                      <p className="muted" style={{ marginBottom: '12px' }}>
                        Кабинет создан автоматически. Используйте этот пароль
                        для входа по номеру телефона:
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap',
                          marginBottom: '16px',
                        }}
                      >
                        <code
                          data-testid="buyer-initial-password"
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: '#f1f5f9',
                            fontSize: '15px',
                            letterSpacing: passwordVisible
                              ? '0.04em'
                              : '0.12em',
                          }}
                        >
                          {passwordVisible && revealedPassword
                            ? revealedPassword
                            : '••••••••••••'}
                        </code>
                        <button
                          type="button"
                          className="button"
                          disabled={passwordBusy}
                          onClick={() => void togglePasswordVisibility()}
                        >
                          {passwordVisible
                            ? 'Скрыть пароль'
                            : 'Показать пароль'}
                        </button>
                        {passwordVisible && revealedPassword && (
                          <button
                            type="button"
                            className="button"
                            onClick={() => void copyPassword()}
                          >
                            {passwordCopied ? 'Скопировано' : 'Копировать'}
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {changePasswordSuccess && (
                    <p
                      role="status"
                      style={{ color: '#16a34a', marginBottom: '12px' }}
                    >
                      {changePasswordSuccess}
                    </p>
                  )}

                  {!showChangePassword ? (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        setShowChangePassword(true);
                        setChangePasswordError('');
                        setChangePasswordSuccess('');
                      }}
                    >
                      {account.hasInitialPassword
                        ? 'Задать свой постоянный пароль'
                        : 'Сменить пароль'}
                    </button>
                  ) : (
                    <form
                      onSubmit={(e) => void submitChangePassword(e)}
                      style={{ marginTop: '12px' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <label>
                          Новый пароль
                          <input
                            type="password"
                            required
                            minLength={12}
                            maxLength={256}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Не менее 12 символов"
                          />
                        </label>
                        <label>
                          Повторите новый пароль
                          <input
                            type="password"
                            required
                            minLength={12}
                            maxLength={256}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Повторите пароль"
                          />
                        </label>
                        {changePasswordError && (
                          <p role="alert" className="error">
                            {changePasswordError}
                          </p>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            gap: '10px',
                            marginTop: '6px',
                          }}
                        >
                          <button
                            type="submit"
                            className="button primary"
                            disabled={changePasswordBusy}
                          >
                            {changePasswordBusy
                              ? 'Сохраняем…'
                              : 'Сохранить пароль'}
                          </button>
                          <button
                            type="button"
                            className="button"
                            onClick={() => {
                              setShowChangePassword(false);
                              setChangePasswordError('');
                            }}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </section>

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

            {mode === 'login' && telegramEnabled && (
              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e2e8f0',
                  textAlign: 'center',
                }}
              >
                {!telegramLoginOpen ? (
                  <div>
                    <p
                      className="muted"
                      style={{ fontSize: '13px', marginBottom: '10px' }}
                    >
                      Забыли пароль или хотите войти без ввода пароля?
                    </p>
                    <button
                      type="button"
                      className="button secondary"
                      style={{
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                      onClick={() => void startTelegramLogin()}
                      disabled={telegramLoginBusy}
                    >
                      <PaymentIcon name="sparkle" size={18} />
                      {telegramLoginBusy
                        ? 'Подключение…'
                        : 'Войти или сбросить пароль через Telegram'}
                    </button>
                    {telegramLoginError && (
                      <p
                        role="alert"
                        className="error"
                        style={{ marginTop: '8px' }}
                      >
                        {telegramLoginError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '16px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        margin: '0 0 8px 0',
                      }}
                    >
                      Вход через Telegram
                    </h3>
                    <p
                      className="muted"
                      style={{ fontSize: '13px', marginBottom: '12px' }}
                    >
                      Отсканируйте QR-код камерой телефона или нажмите кнопку,
                      чтобы открыть бота и отправить контакт для входа.
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        margin: '12px 0',
                      }}
                    >
                      <BuyerInviteQr value={telegramLoginUrl} />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'center',
                        marginTop: '12px',
                      }}
                    >
                      <a
                        href={telegramLoginUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="button primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        Открыть Telegram
                      </a>
                      <button
                        type="button"
                        className="button"
                        onClick={() => {
                          setTelegramLoginOpen(false);
                          setTelegramLoginToken('');
                        }}
                      >
                        Отмена
                      </button>
                    </div>
                    {telegramLoginError && (
                      <p
                        role="alert"
                        className="error"
                        style={{ marginTop: '8px' }}
                      >
                        {telegramLoginError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode === 'login' && (
              <p
                className="muted"
                style={{
                  fontSize: '12px',
                  textAlign: 'center',
                  marginTop: '12px',
                  lineHeight: '1.4',
                }}
              >
                Забыли пароль? Войдите через Telegram выше или обратитесь на
                кассу магазина для сброса доступа по QR-коду.
              </p>
            )}

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
      </main>

      <nav className="buyer-mobile-nav" aria-label="Мобильная навигация">
        <a href="/">
          <NavIcon name="home" size={20} />
          <span>Главная</span>
        </a>
        <a href="/catalog">
          <NavIcon name="grid" size={20} />
          <span>Каталог</span>
        </a>
        <a href="/cart">
          <NavIcon name="cart" size={20} />
          <span>Корзина</span>
        </a>
        <a href="/shops">
          <NavIcon name="shop" size={20} />
          <span>Магазины</span>
        </a>
        <a href="/buyer" aria-current="page">
          <NavIcon name="user" size={20} />
          <span>Профиль</span>
        </a>
      </nav>
    </div>
  );
}
