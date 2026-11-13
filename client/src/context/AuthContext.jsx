import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const boot = async () => {
      const calls = [api.get('/config').then((r) => setConfig(r.data)).catch(() => {})];
      if (localStorage.getItem(TOKEN_KEY)) {
        calls.push(
          api
            .get('/auth/me')
            .then((r) => setUser(r.data.user))
            .catch(() => localStorage.removeItem(TOKEN_KEY))
        );
      }
      await Promise.all(calls);
      setLoading(false);
    };
    boot();
  }, []);

  const startSession = useCallback(({ token, user: u }) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
    return u;
  }, []);

  const login = useCallback(
    async (email, password) => startSession((await api.post('/auth/login', { email, password })).data),
    [startSession]
  );
  const register = useCallback(
    async (form) => startSession((await api.post('/auth/register', form)).data),
    [startSession]
  );
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, setUser, config, loading, login, register, logout }),
    [user, config, loading, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
