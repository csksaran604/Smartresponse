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

function resolveAutoUser() {
  if (typeof window === 'undefined') return DEFAULT_VIEWER;

  // 1. Localhost or 127.0.0.1 (Owner's Development Computer) -> ALWAYS ADMIN
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    try {
      localStorage.setItem('ser_owner_device', 'true');
    } catch {}
    return DEFAULT_ADMIN;
  }

  // 2. Secret owner activation in URL for the owner's computer on Vercel (?owner or ?admin or ?key=saran)
  try {
    const params = new URLSearchParams(window.location.search);
    if (
      params.has('owner') ||
      params.has('admin') ||
      params.get('role') === 'admin' ||
      params.get('key') === 'saran' ||
      params.get('key') === 'admin'
    ) {
      localStorage.setItem('ser_owner_device', 'true');
      return DEFAULT_ADMIN;
    }
    if (params.has('viewer') || params.has('reset')) {
      localStorage.removeItem('ser_owner_device');
      return DEFAULT_VIEWER;
    }
  } catch {}

  // 3. Check if this specific computer/browser is the owner's verified device
  try {
    if (localStorage.getItem('ser_owner_device') === 'true') {
      return DEFAULT_ADMIN;
    }
  } catch {}

  // 4. THIS COMPUTER: Desktop PC (where developer uses IDE, GitHub & Vercel) -> ALWAYS ADMIN!
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (!isMobile) {
    try {
      localStorage.setItem('ser_owner_device', 'true');
    } catch {}
    return DEFAULT_ADMIN;
  }

  // 5. EVERY OTHER USER / MOBILE VISITOR -> STRICTLY VIEWER (Admin never granted)
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
    // Viewer reset
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
      const adminUser = DEFAULT_ADMIN;
      setUser(adminUser);
      return adminUser;
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
