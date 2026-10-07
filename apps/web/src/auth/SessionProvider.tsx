import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api, errorText, setCsrf } from '../api/client';
import { clearUser } from '../drafts/draft-store';
import { Me } from '../api/types';
type Session = {
  user: Me | null;
  loading: boolean;
  error: string;
  shopId: string | null;
  selectShop: (id: string) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [shopId, setShopId] = useState<string | null>(null);
  async function refresh() {
    setError('');
    try {
      const me = await api<Me>('/auth/me');
      setCsrf(me.csrfToken);
      setUser(me);
    } catch (e) {
      setUser(null);
      if ((e as any).status !== 401) setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const expire = () => {
      setUser(null);
      setCsrf('');
    };
    window.addEventListener('mystore:unauthorized', expire);
    return () => window.removeEventListener('mystore:unauthorized', expire);
  }, []);
  async function logout() {
    await api('/auth/web/logout', { method: 'POST' });
    if (user) clearUser(user.userId);
    setCsrf('');
    setShopId(null);
    setUser(null);
  }
  return (
    <Context.Provider
      value={{
        user,
        loading,
        error,
        shopId,
        refresh,
        logout,
        selectShop: (id) => {
          if (user?.shops.some((s) => s.id === id)) setShopId(id);
          else throw new Error('Нет доступа к магазину');
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('SessionProvider required');
  return ctx;
}
