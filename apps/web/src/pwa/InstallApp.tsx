import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
const InstallContext = createContext({
  installed: false,
  available: false,
  busy: false,
  error: '',
  install: async () => {},
});

function standalone() {
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

export function InstallAppProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(standalone);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const media = window.matchMedia?.('(display-mode: standalone)');
    const offered = (event: Event) => {
      if (!('prompt' in event) || typeof event.prompt !== 'function') return;
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setError('');
    };
    const installed = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const displayChanged = () => setInstalled(standalone());
    window.addEventListener('beforeinstallprompt', offered);
    window.addEventListener('appinstalled', installed);
    media?.addEventListener?.('change', displayChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', offered);
      window.removeEventListener('appinstalled', installed);
      media?.removeEventListener?.('change', displayChanged);
    };
  }, []);
  async function install() {
    if (!prompt || busy) return;
    const offered = prompt;
    setPrompt(null);
    setBusy(true);
    setError('');
    try {
      await offered.prompt();
      if ((await offered.userChoice).outcome === 'accepted') setInstalled(true);
    } catch {
      setError('Не удалось открыть установку. Используйте меню браузера.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <InstallContext.Provider
      value={{ installed, available: Boolean(prompt), busy, error, install }}
    >
      {children}
    </InstallContext.Provider>
  );
}

export function InstallApp({ className = '' }: { className?: string }) {
  const { installed, available, busy, error, install } =
    useContext(InstallContext);
  if (installed) return null;
  return (
    <div className={`pwa-install ${className}`}>
      {available && (
        <button type="button" disabled={busy} onClick={() => void install()}>
          Установить приложение
        </button>
      )}
      <details>
        <summary>Установить MyStore</summary>
        <p>MyStore откроется с иконки на вашем устройстве в отдельном окне.</p>
        <p>
          Android или компьютер: откройте меню браузера и выберите «Установить
          приложение» или «Добавить на главный экран».
        </p>
        <p>
          iPhone или iPad: откройте сайт в Safari → «Поделиться» → На экран
          «Домой».
        </p>
        <p>Для входа, продаж и обновления остатков нужен интернет.</p>
      </details>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
