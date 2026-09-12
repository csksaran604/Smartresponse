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
  if (typeof window === 'undefined') return DEFAULT_ADMIN;

  // 1. Check URL parameters for explicit role override (?role=admin or ?role=viewer)
  try {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role') || params.get('as');
    if (roleParam) {
      const upper = roleParam.toUpperCase();
      if (upper === 'ADMIN' || upper === 'OPERATOR') {
        localStorage.setItem('ser_role', 'ADMIN');
        return DEFAULT_ADMIN;
      } else if (upper === 'VIEWER') {
        localStorage.setItem('ser_role', 'VIEWER');
        return DEFAULT_VIEWER;
      }
    }
  } catch {}

  // 2. Check saved user preference in localStorage
  try {
    const savedRole = localStorage.getItem('ser_role');
    if (savedRole === 'ADMIN') return DEFAULT_ADMIN;
    if (savedRole === 'VIEWER') return DEFAULT_VIEWER;
  } catch {}

  // 3. Localhost / Local PC development environment -> ALWAYS ADMIN
  try {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      localStorage.setItem('ser_role', 'ADMIN');
      return DEFAULT_ADMIN;
    }
  } catch {}

  // 4. Default for any other device / visitor -> VIEWER
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

  const toggleRole = () => {
    const newRole = user?.role === 'ADMIN' ? 'VIEWER' : 'ADMIN';
    const newUser = newRole === 'ADMIN' ? DEFAULT_ADMIN : DEFAULT_VIEWER;
    setUser(newUser);
    try {
      localStorage.setItem('ser_role', newRole);
      localStorage.setItem('ser_user', JSON.stringify(newUser));
    } catch {}
    return newUser;
  };

  const logout = async () => {
    // Seamlessly reset back to Viewer role without blocking with a login screen
    setUser(DEFAULT_VIEWER);
    try {
      localStorage.setItem('ser_role', 'VIEWER');
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
      localStorage.setItem('ser_role', receivedUser.role);
      return receivedUser;
    } catch {
      // Fallback directly to Admin if credentials provided
      const adminUser = DEFAULT_ADMIN;
      setUser(adminUser);
      localStorage.setItem('ser_role', 'ADMIN');
      return adminUser;
    }
  };

  const register = async (formData) => {
    const defaultUser = DEFAULT_ADMIN;
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
        toggleRole,
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
