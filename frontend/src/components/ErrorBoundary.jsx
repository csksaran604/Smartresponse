import React from 'react';
import { AlertTriangle, RefreshCw, Radio } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SER System caught UI exception:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleGoSos = () => {
    window.location.href = '/sos';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mb-5 text-rose-500 shadow-xl shadow-rose-950/50">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-black tracking-tight text-white mb-2">
            Smart Emergency Response System
          </h1>
          <p className="text-xs text-slate-400 font-mono max-w-md mb-6">
            A temporary display error occurred while rendering the operations interface.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-900/30 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload System</span>
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-all"
            >
              Operations Dashboard
            </button>
            <button
              onClick={this.handleGoSos}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 font-medium text-xs border border-amber-500/30 transition-all"
            >
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span>Citizen SOS</span>
            </button>
          </div>

          {this.state.error?.message && (
            <div className="mt-8 max-w-md w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-left">
              <p className="text-[10px] text-slate-400 font-mono break-words">
                Detail: {this.state.error.message}
              </p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
