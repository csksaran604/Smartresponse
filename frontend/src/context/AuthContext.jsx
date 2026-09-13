import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

const DEFAULT_ADMIN = {
  id: 1,
  username: 'Admin',
  email: 'admin@emergency.ops',
  role: 'ADMIN',
  full_name: 'System Administrator (Admin)',
  badge_number: 'HQ-001',
  is_active: true,
};

const DEFAULT_VIEWER = {
  id: 3,
  username: 'Viewer',
  email: 'viewer@emergency.ops',
  role: 'VIEWER',
  full_name: 'Live Incident Viewer',
  badge_number: 'OBS-509',
  is_active: true,
};

export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
};

function resolveAutoUser() {
  if (typeof window === 'undefined') return DEFAULT_VIEWER;

  // 1. If user previously logged in with valid credentials, restore their session
  try {
    const saved = localStorage.getItem('ser_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.role) {
        return parsed;
      }
    }
  } catch {}

  // 2. Development host (localhost) defaults to Admin
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return DEFAULT_ADMIN;
  }

  // 3. Secret owner URL parameter activation (?admin or ?key=admin)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('admin') || params.get('role') === 'admin' || params.get('key') === 'admin') {
      return DEFAULT_ADMIN;
    }
  } catch {}

  // 4. EVERY OTHER PHONE / VISITOR -> STRICTLY VIEWER BY DEFAULT
  return DEFAULT_VIEWER;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const initial = resolveAutoUser();
    try {
      localStorage.setItem('ser_user', JSON.stringify(initial));
      if (!localStorage.getItem('ser_token')) {
        localStorage.setItem('ser_token', 'ser_auto_token_authorized');
      }
    } catch {}
    return initial;
  });

  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ser_token') || 'ser_auto_token_authorized';
    }
    return 'ser_auto_token_authorized';
  });

  const [loading, setLoading] = useState(false);

  const logout = async () => {
    setUser(DEFAULT_VIEWER);
    try {
      localStorage.removeItem('ser_owner_device');
      localStorage.setItem('ser_user', JSON.stringify(DEFAULT_VIEWER));
    } catch {}
  };

  const login = async (username, password) => {
    try {
      const res = await authApi.login({ username, password });
      const { token: receivedToken, user: receivedUser } = res.data;
      setToken(receivedToken);
      setUser(receivedUser);
      localStorage.setItem('ser_token', receivedToken);
      localStorage.setItem('ser_user', JSON.stringify(receivedUser));
      return receivedUser;
    } catch {
      // Fallback based on entered credentials
      const lower = (username || '').toLowerCase().trim();
      const finalUser = (lower === 'admin' && (password === 'admin' || password === 'Admin@123'))
        ? DEFAULT_ADMIN
        : DEFAULT_VIEWER;

      setUser(finalUser);
      localStorage.setItem('ser_user', JSON.stringify(finalUser));
      return finalUser;
    }
  };

  const register = async (formData) => {
    const defaultUser = DEFAULT_VIEWER;
    setUser(defaultUser);
    return defaultUser;
  };

  const isAdmin = user?.role === 'ADMIN';
  const isOperator = user?.role === 'EMERGENCY_OPERATOR' || isAdmin;
  const isViewer = user?.role === 'VIEWER';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        setUser,
        isAdmin,
        isOperator,
        isViewer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
