import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ScanEye,
  AlertOctagon,
  MapPin,
  Ambulance,
  Bell,
  BarChart3,
  UserCheck,
  Settings,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ isOpen, setIsOpen }) => {
  const { user, isAdmin } = useAuth();

  const mainLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/map', label: 'Live GPS Map', icon: MapPin },
    { to: '/detection', label: 'AI Detection', icon: ScanEye, badge: 'AI' },
    { to: '/incidents', label: 'Incidents', icon: AlertOctagon },
    { to: '/units', label: 'Emergency Units', icon: Ambulance },
    { to: '/alerts', label: 'Alerts', icon: Bell },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/citizen', label: 'Citizen SOS & Help', icon: Radio, badge: 'SOS' },
  ];

  const accountLinks = [
    { to: '/profile', label: 'My Profile', icon: UserCheck },
    { to: '/settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-[100] w-64 bg-slate-900/95 border-r border-slate-800/80 backdrop-blur-md transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-900/30">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              SER SYSTEM <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">Ops</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Smart Emergency Network</p>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Operations */}
          <div>
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono mb-2">
              Operations Center
            </div>
            <nav className="space-y-1">
              {mainLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-slate-400 group-hover:text-white" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Preferences */}
          <div>
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono mb-2">
              System
            </div>
            <nav className="space-y-1">
              {accountLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Current User Session Strip */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs uppercase ${
              isAdmin ? 'bg-rose-950/60 border-rose-600/50 text-rose-400' : 'bg-blue-950/60 border-blue-600/50 text-blue-400'
            }`}>
              {isAdmin ? 'AD' : 'VW'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.full_name || (isAdmin ? 'Admin' : 'Viewer')}</p>
              <p className="text-[10px] text-slate-400 font-mono uppercase truncate">
                Role: <span className={isAdmin ? 'text-rose-400 font-bold' : 'text-blue-400 font-bold'}>{user?.role || 'VIEWER'}</span>
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
