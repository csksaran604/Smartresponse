import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = () => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-400">Loading Smart Emergency Response System...</p>
        </div>
      </div>
    );
  }

  // Check if owner/admin device
  const isOwnerAdmin = (typeof window !== 'undefined' && localStorage.getItem('ser_owner_device') === 'true') || isAdmin;

  // Viewers are strictly prohibited from viewing the admin dashboard - redirect directly to Citizen SOS
  if (!isOwnerAdmin) {
    return <Navigate to="/sos" replace />;
  }

  return <Outlet />;
};
