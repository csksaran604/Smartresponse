import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu,
  Bell,
  LogOut,
  User as UserIcon,
  Activity,
  Cpu,
  Volume2,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationsApi, healthApi } from '../services/api';
import { formatDateTime } from '../utils/dateUtils';
import { cleanPhoneNumber, cleanLocation, isDummyPhoneNumber, SAMPLE_ACCIDENT_PHOTO } from '../services/mockData';

export const Navbar = ({ setIsSidebarOpen }) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);

  const fetchAlerts = async () => {
    try {
      const res = await notificationsApi.getNotifications({ limit: 5 });
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (e) {
      console.warn('Could not fetch alerts:', e);
    }
  };

  const checkHealth = async () => {
    try {
      const res = await healthApi.checkHealth();
      setSystemHealth(res.data);
    } catch (_e) {
      setSystemHealth({ status: 'degraded' });
    }
  };

  useEffect(() => {
    fetchAlerts();
    checkHealth();
    const interval = setInterval(fetchAlerts, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 flex items-center justify-between">
      {/* Left section: Hamburger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="lg:hidden p-2 rounded-lg bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Emergency Dispatch System
          </span>
        </div>
      </div>

      {/* Right controls: Health Pill, Model Chip, Notifications, Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Test Siren & Alert Modal Button */}
        <button
          type="button"
          onClick={() => {
            const fireTestEvent = (lat, lng, addr) => {
              let recentSos = null;
              try {
                const saved = localStorage.getItem('ser_active_sos');
                if (saved) recentSos = JSON.parse(saved);
              } catch {}

              const userSavedPhoto = typeof window !== 'undefined' ? (localStorage.getItem('ser_user_uploaded_photo') || localStorage.getItem('ser_latest_sos_photo')) : null;
              const recentPhoto = userSavedPhoto || recentSos?.photo || null;
              const userSavedPhone = typeof window !== 'undefined' ? (localStorage.getItem('ser_user_phone') || '') : '';
              const realPhone = !isDummyPhoneNumber(userSavedPhone) ? userSavedPhone : (!isDummyPhoneNumber(recentSos?.phone) ? recentSos.phone : '');
              const citizenPhone = realPhone || cleanPhoneNumber('', 'SOS-CITIZEN');
              const userSavedNotes = typeof window !== 'undefined' ? (localStorage.getItem('ser_user_notes') || '') : '';
              const alertNotes = userSavedNotes || recentSos?.notes || 'Citizen reported emergency distress call. Immediate rescue dispatched.';

              const userSavedType = typeof window !== 'undefined' ? (localStorage.getItem('ser_selected_distress_type') || recentSos?.emergencyType || recentSos?.type || 'Medical') : 'Medical';

              const testAlert = {
                id: recentSos?.id || `SOS-${Date.now().toString().slice(-4)}`,
                type: userSavedType,
                emergencyType: userSavedType,
                latitude: recentSos?.latitude || lat,
                longitude: recentSos?.longitude || lng,
                address: cleanLocation(recentSos?.address || addr || `Perundurai Road, Erode, Tamil Nadu`),
                notes: alertNotes,
                reporter_phone: citizenPhone,
                phone: citizenPhone,
                photo: recentPhoto,
                urgency: 'Critical',
                timestamp: new Date().toISOString(),
              };
              try {
                localStorage.setItem('ser_active_sos', JSON.stringify(testAlert));
                if (recentPhoto) {
                  localStorage.setItem('ser_latest_sos_photo', recentPhoto);
                  localStorage.setItem(`ser_sos_photo_${testAlert.id}`, recentPhoto);
                }
              } catch {}
              window.dispatchEvent(new CustomEvent('ser_emergency_sos', { detail: testAlert }));
            };

            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;
                  let resolvedAddr = `Perundurai Road, Erode, Tamil Nadu`;
                  try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                    if (res.ok) {
                      const data = await res.json();
                      const parts = [
                        data.address?.road || data.address?.suburb || data.address?.neighbourhood,
                        data.address?.city || data.address?.town || data.address?.state_district,
                      ].filter(Boolean);
                      if (parts.length > 0) {
                        resolvedAddr = parts.join(', ');
                      } else if (data.display_name) {
                        resolvedAddr = data.display_name.split(',').slice(0, 3).join(',').trim();
                      }
                    }
                  } catch {}
                  fireTestEvent(lat, lng, resolvedAddr);
                },
                () => {
                  fireTestEvent(11.3410, 77.7172, 'Perundurai Road, Erode, Tamil Nadu');
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
              );
            } else {
              fireTestEvent(11.3410, 77.7172, 'Perundurai Road, Erode, Tamil Nadu');
            }
          }}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono border border-slate-700 transition-colors"
          title="Test Audio Siren Alarm & Emergency Modal"
        >
          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Test Alarm</span>
        </button>

        {/* Citizen SOS Quick Action */}
        <Link
          to="/sos"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-md shadow-rose-950 transition-all active:scale-95 animate-pulse"
        >
          <span>🚨 Citizen SOS</span>
        </Link>

        {/* Model Status Diagnostic Chip */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-mono">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400">AI:</span>
          {systemHealth?.ai_engine?.model_configured ? (
            <span className="text-emerald-400 font-semibold">Trained YOLO Active</span>
          ) : (
            <span className="text-amber-400 font-semibold">Diagnostic Mode</span>
          )}
        </div>

        {/* Database Status Chip */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-mono">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">DB:</span>
          <span className="text-slate-200">{systemHealth?.database?.engine || 'Connected'}</span>
        </div>

        {/* Notification Bell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg shadow-rose-900/40">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl shadow-black/80 py-2 z-50">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  System Alerts ({unreadCount} unread)
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Mark read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/50">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No recent notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 text-left transition-colors ${
                        n.is_read ? 'opacity-60 bg-transparent' : 'bg-slate-800/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-200">{n.title}</p>
                        <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded ${
                          n.severity === 'critical'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : n.severity === 'warning'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        }`}>
                          {n.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-1.5">
                        {formatDateTime(n.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="px-4 py-2 border-t border-slate-800 text-center">
                <Link
                  to="/alerts"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                >
                  View all in Alert Center &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Account / Role Display (Read-Only, No Switcher) */}
        <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
          <div
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border select-none ${
              isAdmin
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-slate-850 border-slate-800 text-slate-400'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shadow-md ${
              isAdmin ? 'bg-gradient-to-br from-rose-600 to-red-600 shadow-rose-950/50' : 'bg-slate-750 text-slate-300'
            }`}>
              {isAdmin ? 'A' : 'V'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                <span className="text-slate-200">{isAdmin ? 'Admin' : 'Viewer'}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                  isAdmin ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-700/40 text-slate-400 border border-slate-700'
                }`}>
                  {isAdmin ? 'ADMIN' : 'VIEWER'}
                </span>
              </p>
              <p className="text-[10px] font-mono text-slate-500">
                {isAdmin ? 'Owner Device' : 'Read-Only'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
