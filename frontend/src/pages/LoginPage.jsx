import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, User, Radio, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 items-center justify-center shadow-xl shadow-rose-950/50 mb-3">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">SER SYSTEM</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">Smart Emergency Response & Accident Detection</p>
        </div>

        {/* Public SOS Quick Access Alert Banner */}
        <Link
          to="/sos"
          className="mb-4 block p-3.5 rounded-2xl bg-gradient-to-r from-rose-600/30 via-red-600/20 to-amber-600/20 border-2 border-rose-500/60 hover:border-rose-400 shadow-xl shadow-rose-950/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500 flex items-center justify-center animate-pulse">
                <Radio className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-xs font-black text-rose-300 uppercase tracking-wider block">
                  🚨 NEED URGENT HELP? 1-TAP SOS
                </span>
                <span className="text-[11px] text-slate-300 font-mono">
                  Public Citizen Portal • No Login Required
                </span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
              OPEN SOS →
            </span>
          </div>
        </Link>

        {/* Login Box */}
        <div className="glass-panel p-8 rounded-2xl border border-slate-800 shadow-2xl relative">
          <h2 className="text-lg font-bold text-white mb-2">Terminal Authentication</h2>
          <p className="text-xs text-slate-400 mb-6">Enter authorized credentials to access emergency dispatch network.</p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Username / Call-Sign
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or operator or viewer"
                  className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-rose-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Security Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/90 border border-slate-700/80 focus:border-rose-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-sm font-bold tracking-wide shadow-lg shadow-rose-900/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Access Operational Terminal</span>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Buttons */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-2 text-center">
              Quick-Fill Evaluator Credentials:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('admin', 'Admin@123')}
                className="py-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-[11px] font-mono text-rose-300 border border-slate-700 hover:border-rose-500/50 transition-all text-center"
              >
                ADMIN
              </button>
              <button
                type="button"
                onClick={() => fillDemo('operator', 'Operator@123')}
                className="py-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-[11px] font-mono text-amber-300 border border-slate-700 hover:border-amber-500/50 transition-all text-center"
              >
                OPERATOR
              </button>
              <button
                type="button"
                onClick={() => fillDemo('viewer', 'Viewer@123')}
                className="py-1.5 px-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-[11px] font-mono text-emerald-300 border border-slate-700 hover:border-emerald-500/50 transition-all text-center"
              >
                VIEWER
              </button>
            </div>
          </div>

          <div className="mt-4 text-center">
            <Link to="/register" className="text-xs text-slate-400 hover:text-white transition-colors">
              Need account creation? <span className="text-rose-400 underline">Register new personnel</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
