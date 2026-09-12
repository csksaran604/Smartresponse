import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { EmergencyAlertModal } from './components/EmergencyAlertModal';

// Pages
import { PublicSosPage } from './pages/PublicSosPage';
import { CitizenPortalPage } from './pages/CitizenPortalPage';
import { DashboardPage } from './pages/DashboardPage';
import { AccidentDetectionPage } from './pages/AccidentDetectionPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { EmergencyUnitsPage } from './pages/EmergencyUnitsPage';
import { AlertsPage } from './pages/AlertsPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

// Smart Root Route: Mobile phones and Viewers go directly to Citizen SOS portal, Desktop Admin goes to Operator Dashboard
const RootRoute = () => {
  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isOwner = typeof window !== 'undefined' && localStorage.getItem('ser_owner_device') === 'true';

  if (isMobile || !isOwner) {
    return <Navigate to="/sos" replace />;
  }
  return <DashboardPage />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Global Emergency Alert Listener (Siren + Modal when mobile triggers SOS - Admin Only) */}
        <EmergencyAlertModal />

        <Routes>
          {/* Public Citizen SOS Portals */}
          <Route path="/sos" element={<PublicSosPage />} />
          <Route path="/citizen" element={<PublicSosPage />} />

          {/* Login/Register routes bypass directly to appropriate destination */}
          <Route path="/login" element={<RootRoute />} />
          <Route path="/register" element={<RootRoute />} />

          {/* Operations Center - Restricted to Admin / Owner Device */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<RootRoute />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/portal" element={<CitizenPortalPage />} />
              <Route path="/detection" element={<AccidentDetectionPage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/incidents/:id" element={<IncidentDetailPage />} />
              <Route path="/map" element={<LiveMapPage />} />
              <Route path="/units" element={<EmergencyUnitsPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<RootRoute />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
