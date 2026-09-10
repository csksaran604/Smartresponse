import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  Clock,
  ShieldCheck,
  Ambulance,
  Radio,
  Flame,
  TrendingUp,
  Activity,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { dashboardApi } from '../services/api';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { formatDateTime } from '../utils/dateUtils';

const SEVERITY_COLORS = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#f59e0b',
  Low: '#10b981',
};

const STATUS_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#64748b'];

export const DashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSos, setActiveSos] = useState(() => {
    try {
      const saved = localStorage.getItem('ser_active_sos');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleSos = (e) => {
      if (e.detail) setActiveSos(e.detail);
    };
    window.addEventListener('ser_emergency_sos', handleSos);
    return () => window.removeEventListener('ser_emergency_sos', handleSos);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [sumRes, anaRes] = await Promise.all([
        dashboardApi.getSummary(),
        dashboardApi.getAnalytics(),
      ]);
      setMetrics(sumRes.data.metrics);
      setRecentIncidents(sumRes.data.recent_incidents || []);
      setAnalytics(anaRes.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-4" />
        <p className="text-xs font-mono text-slate-400">Loading operations telemetry...</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Incidents',
      value: metrics?.total_incidents ?? 0,
      sub: 'All recorded incidents',
      icon: AlertOctagon,
      color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
    },
    {
      title: "Today's Incidents",
      value: metrics?.today_incidents ?? 0,
      sub: 'Recorded since 00:00 UTC',
      icon: Clock,
      color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400',
    },
    {
      title: 'Active Dispatches',
      value: metrics?.active_incidents ?? 0,
      sub: 'En Route / On Scene / Assigned',
      icon: Radio,
      color: 'from-rose-500/20 to-pink-500/10 border-rose-500/30 text-rose-400',
      pulse: (metrics?.active_incidents ?? 0) > 0,
    },
    {
      title: 'Verified Incidents',
      value: metrics?.verified_incidents ?? 0,
      sub: 'Confirmed by human operator',
      icon: ShieldCheck,
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
    },
    {
      title: 'Pending Verification',
      value: metrics?.pending_verification ?? 0,
      sub: 'Awaiting operator review',
      icon: Clock,
      color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-300',
      pulse: (metrics?.pending_verification ?? 0) > 0,
    },
    {
      title: 'Emergency Units Available',
      value: metrics?.units_available ?? 0,
      sub: `${metrics?.units_assigned ?? 0} currently assigned`,
      icon: Ambulance,
      color: 'from-emerald-500/20 to-cyan-500/10 border-emerald-500/30 text-emerald-300',
    },
    {
      title: 'High/Critical Incidents',
      value: metrics?.high_severity_incidents ?? 0,
      sub: 'Priority emergency level',
      icon: Flame,
      color: 'from-rose-600/20 to-orange-600/10 border-rose-600/30 text-rose-400',
    },
    {
      title: 'Avg. Response Time',
      value: `${metrics?.avg_response_time_minutes ?? 4.5}m`,
      sub: 'Dispatch to scene arrival',
      icon: Activity,
      color: 'from-indigo-500/20 to-blue-500/10 border-indigo-500/30 text-indigo-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Operations Telemetry Dashboard
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time incident response tracking and autonomous vision metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <Link
            to="/detection"
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-900/40 transition-all"
          >
            <span>Run AI Vision</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Active Live Citizen SOS Banner */}
      {activeSos && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/90 via-red-950/70 to-slate-900 border-2 border-rose-500 shadow-2xl shadow-rose-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-900 animate-bounce">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-rose-300 font-mono tracking-wider">
                  🚨 LIVE CITIZEN SOS SIGNAL
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {activeSos.type || 'Medical'} Emergency • {activeSos.timestamp ? formatDateTime(activeSos.timestamp) : 'Just now'}
                </span>
              </div>
              <p className="text-sm font-bold text-white mt-1">
                {activeSos.address || 'Live Citizen Location'}
              </p>
              {activeSos.notes && (
                <p className="text-xs text-rose-200/80 mt-0.5 font-medium">
                  "{activeSos.notes}"
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/map"
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-900/40 transition-all"
            >
              <span>View on Live Map</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('ser_active_sos');
                setActiveSos(null);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-mono border border-slate-700 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`glass-panel p-4 rounded-xl border bg-gradient-to-br ${card.color} relative overflow-hidden transition-all`}
            >
              {card.pulse && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono truncate">
                  {card.title}
                </span>
                <Icon className="w-4 h-4 shrink-0 opacity-80" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {card.value}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-mono truncate">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1: Daily Accidents Trend & Accidents by Severity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Trend Line Chart */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Accidents By Day (Last 7 Days)</h2>
              <p className="text-xs text-slate-400">Incident volume distribution over the past week</p>
            </div>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.by_day || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Line
                  type="monotone"
                  dataKey="incidents"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#ef4444' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Distribution Donut Chart */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-white">Incidents by Severity</h2>
            <p className="text-xs text-slate-400">Classification distribution across all incidents</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.by_severity || []}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {(analytics?.by_severity || []).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SEVERITY_COLORS[entry.name] || '#64748b'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Status Breakdown & Hotspot Locations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown Bar Chart */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-white">Incident Response Status Distribution</h2>
            <p className="text-xs text-slate-400">Current state of active & closed dispatches</p>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.by_status || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  {(analytics?.by_status || []).map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hotspot Locations */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-white">Top Incident Hotspot Zones</h2>
            <p className="text-xs text-slate-400">Locations reporting highest incident occurrences</p>
          </div>
          <div className="space-y-3">
            {(analytics?.by_location || []).slice(0, 5).map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <p className="text-xs font-medium text-slate-200 truncate">{item.location}</p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                  {item.count} incidents
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white">Recent Logged Incidents</h2>
            <p className="text-xs text-slate-400">Directly fetched from database records</p>
          </div>
          <Link
            to="/incidents"
            className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 uppercase font-mono text-[10px] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Incident ID</th>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">AI Confidence</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Response Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {recentIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No incidents logged in the system.
                  </td>
                </tr>
              ) : (
                recentIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors font-sans">
                    <td className="py-3 px-4 font-mono font-bold text-rose-400">
                      {inc.incident_id}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-xs">
                      {formatDateTime(inc.date_time)}
                    </td>
                    <td className="py-3 px-4 max-w-[200px] truncate text-slate-200">
                      {inc.address}
                    </td>
                    <td className="py-3 px-4">
                      <SeverityBadge severity={inc.severity} />
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="text-slate-300 font-semibold">{inc.ai_confidence}%</span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={inc.verification_status} type="verification" />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={inc.response_status} type="response" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/incidents/${inc.id}`}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
