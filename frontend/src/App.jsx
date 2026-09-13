import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { EmergencyAlertModal } from './components/EmergencyAlertModal';

import { ErrorBoundary } from './components/ErrorBoundary';

// Pages
import { PublicSosPage } from './pages/PublicSosPage';
import { CitizenPortalPage } from './pages/CitizenPortalPage';
import { DashboardPage } from './pages/DashboardPage';
import { AccidentDetectionPage } from './pages/AccidentDetectionPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { EmergencyUnitsPage } from './pages/EmergencyUnitsPage';
import { AlertsPage } from './pages/AlertsPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

import { LoginPage } from './pages/LoginPage';

// Smart Navigation Resolver: Mobile visitors go directly to Citizen SOS, Desktop Admin goes to Dashboard, Viewer to Map
const EntryRedirect = () => {
  const { isViewer } = useAuth();
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    return <Navigate to="/sos" replace />;
  }
  if (isViewer) {
    return <Navigate to="/map" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

// Dashboard Route: Restricted to Admin/Operators. Viewers are redirected to Live GPS Map.
const DashboardRoute = () => {
  const { isViewer } = useAuth();
  if (isViewer) {
    return <Navigate to="/map" replace />;
  }
  return <DashboardPage />;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          {/* Global Emergency Alert Listener (Siren + Modal when mobile triggers SOS - Admin Only) */}
          <EmergencyAlertModal />

          <Routes>
            {/* Public Citizen SOS Portals */}
            <Route path="/sos" element={<PublicSosPage />} />
            <Route path="/citizen" element={<PublicSosPage />} />

            {/* Auth / Entry Redirects */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<EntryRedirect />} />

            {/* Operations Center - Restricted to Admin / Owner Device */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<DashboardRoute />} />
                <Route path="/dashboard" element={<DashboardRoute />} />
                <Route path="/portal" element={<CitizenPortalPage />} />
                <Route path="/detection" element={<AccidentDetectionPage />} />
                <Route path="/incidents" element={<Navigate to="/alerts" replace />} />
                <Route path="/incidents/:id" element={<Navigate to="/alerts" replace />} />
                <Route path="/map" element={<LiveMapPage />} />
                <Route path="/units" element={<EmergencyUnitsPage />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<EntryRedirect />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
