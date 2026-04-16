import { createContext, useContext, useState } from 'react';
import { superAdminLogin } from '../api/admin.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('sa_user');
    return saved ? JSON.parse(saved) : null;
  });

  async function login(email, password) {
    const res = await superAdminLogin({ email, password });
    const { user: u, token } = res.data.data;
    localStorage.setItem('sa_token', token);
    localStorage.setItem('sa_user', JSON.stringify(u));
    setUser(u);
    return u;
  }

  function logout() {
    localStorage.removeItem('sa_token');
    localStorage.removeItem('sa_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
