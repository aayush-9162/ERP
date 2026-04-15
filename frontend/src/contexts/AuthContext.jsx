import { createContext, useContext, useState, useEffect } from 'react';
import { loginApi, getProfileApi } from '../api/auth.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [activeCompany, setActiveCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getProfileApi()
        .then((res) => {
          setUser(res.data.data.user);
          const comps = res.data.data.companies || [];
          setCompanies(comps);

          // Restore or set active company
          const savedId = localStorage.getItem('activeCompanyId');
          const saved = comps.find((c) => String(c.id) === savedId);
          if (saved) {
            setActiveCompany(saved);
          } else if (comps.length > 0) {
            setActiveCompany(comps[0]);
            localStorage.setItem('activeCompanyId', comps[0].id);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('activeCompanyId');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    const res = await loginApi({ email, password });
    const { user, token, companies: comps } = res.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);

    const compList = comps || [];
    setCompanies(compList);
    if (compList.length > 0) {
      setActiveCompany(compList[0]);
      localStorage.setItem('activeCompanyId', compList[0].id);
    }

    return user;
  }

  function switchCompany(company) {
    setActiveCompany(company);
    localStorage.setItem('activeCompanyId', company.id);
    window.location.reload(); // Reload to refetch all data for new company
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activeCompanyId');
    setUser(null);
    setCompanies([]);
    setActiveCompany(null);
  }

  const isAdmin = user?.role?.name === 'admin' || activeCompany?.role === 'admin';
  const isManager = user?.role?.name === 'manager' || activeCompany?.role === 'manager';

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout,
      companies, activeCompany, switchCompany,
      isAdmin, isManager,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
