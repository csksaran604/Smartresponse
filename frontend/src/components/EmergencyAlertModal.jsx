import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Volume2,
  VolumeX,
  X,
  MapPin,
  ExternalLink,
  Ambulance,
  Shield,
  Flame,
  Radio,
  PhoneCall,
  Navigation,
  Compass,
  Clock,
  Camera,
  ZoomIn,
  CheckCircle2
} from 'lucide-react';
import { subscribeToEmergencyAlerts, isAlertDismissed, markAlertDismissed, checkPendingCloudAlert } from '../services/realtimeEmergency';
import { accidentsApi } from '../services/api';
import { startEmergencySiren, stopEmergencySiren, enableSiren } from '../utils/sirenSound';
import { cleanPhoneNumber, cleanLocation, isDummyPhoneNumber } from '../services/mockData';
import { useAuth } from '../context/AuthContext';

// Internal error boundary so modal errors can NEVER crash or unmount the modal
class ModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err, info) {
    console.warn('EmergencyAlertModal internal render issue caught:', err, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

// Haversine Distance helper
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
};

export const EmergencyAlertModal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isViewer } = useAuth();
  const [activeAlert, setActiveAlert] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const activeAlertRef = useRef(null);

  useEffect(() => {
    activeAlertRef.current = activeAlert;
  }, [activeAlert]);

  // Keep ref updated to current role without closure race conditions
  const isAdminRef = useRef(isAdmin);
  useEffect(() => {
    isAdminRef.current = Boolean(isAdmin && !isViewer);
  }, [isAdmin, isViewer]);

  // Operator / Responder Live Location
  const [responderLocation, setResponderLocation] = useState(null);

  // Fullscreen Photo Lightbox Modal
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Acquire Operator's Live GPS Location
  const getResponderLocation = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setResponderLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          try {
            localStorage.setItem('ser_user_last_lat', String(pos.coords.latitude));
            localStorage.setItem('ser_user_last_lng', String(pos.coords.longitude));
          } catch {}
        },
        (err) => {
          console.warn('Operator GPS note:', err);
          const cachedLat = typeof window !== 'undefined' ? localStorage.getItem('ser_user_last_lat') : null;
          const cachedLng = typeof window !== 'undefined' ? localStorage.getItem('ser_user_last_lng') : null;
          setResponderLocation({
            lat: cachedLat ? parseFloat(cachedLat) : 11.3410,
            lng: cachedLng ? parseFloat(cachedLng) : 77.7172,
          });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      const cachedLat = typeof window !== 'undefined' ? localStorage.getItem('ser_user_last_lat') : null;
      const cachedLng = typeof window !== 'undefined' ? localStorage.getItem('ser_user_last_lng') : null;
      setResponderLocation({
        lat: cachedLat ? parseFloat(cachedLat) : 11.3410,
        lng: cachedLng ? parseFloat(cachedLng) : 77.7172,
      });
    }
  }, []);

  const triggerEmergencyAlert = useCallback((incomingAlert) => {
    if (!incomingAlert || !incomingAlert.id) return;
    if (isAlertDismissed(incomingAlert.id)) return;

    // If currently displaying this EXACT same alert, do not restart siren or re-render
    if (activeAlertRef.current && String(activeAlertRef.current.id) === String(incomingAlert.id)) {
      return;
    }

    // Format incoming citizen emergency data
    const alertType = incomingAlert.emergencyType || incomingAlert.type || 'Medical';
    const cleanAddr = cleanLocation(incomingAlert.address);

    const rawNotes = typeof incomingAlert.notes === 'string'
      ? incomingAlert.notes
      : (incomingAlert.notes ? String(incomingAlert.notes) : '');

    const remotePhone = (!isDummyPhoneNumber(incomingAlert.reporter_phone) ? String(incomingAlert.reporter_phone) : '') ||
                        (!isDummyPhoneNumber(incomingAlert.phone) ? String(incomingAlert.phone) : '');
    const userPhone = remotePhone || cleanPhoneNumber('', incomingAlert.id);
    const remotePhoto = incomingAlert.photo || incomingAlert.photo_url || incomingAlert.thumbnail || null;

    const formattedAlert = {
      ...incomingAlert,
      reporter_phone: userPhone,
      phone: userPhone,
      type: alertType,
      emergencyType: alertType,
      address: cleanAddr,
      notes: rawNotes,
      photo: remotePhoto,
      thumbnail: incomingAlert.thumbnail || (remotePhoto && remotePhoto.length < 3000 ? remotePhoto : null),
    };

    setActiveAlert(formattedAlert);
    activeAlertRef.current = formattedAlert;

    // Persist alert immediately to backend/database so it is NEVER lost or deleted on navigation
    try {
      if (!incomingAlert._dbSaved) {
        incomingAlert._dbSaved = true;
        accidentsApi.createAccident({
          id: incomingAlert.id,
          incident_id: incomingAlert.id,
          latitude: Number(incomingAlert.latitude),
          longitude: Number(incomingAlert.longitude),
          address: cleanAddr,
          description: `[CITIZEN SOS] ${alertType} distress call. Contact: ${userPhone}. ${rawNotes}`,
          severity: 'Critical',
          emergency_type: alertType,
          type: alertType,
          reporter: `Citizen (${userPhone})`,
          phone: userPhone,
          phone_number: userPhone,
          reporter_phone: userPhone,
          ai_confidence: 99.0,
          verification_status: 'Verified',
          photo: remotePhoto,
          date_time: incomingAlert.timestamp || new Date().toISOString(),
          created_at: incomingAlert.timestamp || new Date().toISOString(),
        }).catch(() => {});
      }
    } catch {}

    // Emergency Siren: Audible ONLY for Admin device
    try {
      enableSiren(true);
      startEmergencySiren();
      setIsMuted(false);
    } catch {}

    // Desktop browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`🚨 CITIZEN SOS: ${alertType}`, {
          body: `${cleanAddr}\nContact: ${userPhone}`,
          icon: '/favicon.ico',
        });
      } catch {}
    }
  }, []);

  // Check for freshly submitted reports / SOS sent while admin was logging in
  useEffect(() => {
    if (!isAdmin || isViewer) return;

    const checkForPendingAlerts = async () => {
      // If an alert is already active on admin screen, retain it
      if (activeAlertRef.current) return;

      // 1. Check local storage for undismissed emergency alert
      try {
        const saved = localStorage.getItem('ser_active_sos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id && !isAlertDismissed(parsed.id)) {
            triggerEmergencyAlert(parsed);
            return;
          }
        }
      } catch {}

      // 2. Check cloud ntfy relays / REST object for any citizen report sent right before admin login
      try {
        const cloudAlert = await checkPendingCloudAlert();
        if (cloudAlert && cloudAlert.id && !isAlertDismissed(cloudAlert.id)) {
          triggerEmergencyAlert(cloudAlert);
          return;
        }
      } catch {}
    };

    checkForPendingAlerts();
    const interval = setInterval(checkForPendingAlerts, 2000);
    return () => clearInterval(interval);
  }, [isAdmin, isViewer, triggerEmergencyAlert]);

  useEffect(() => {
    getResponderLocation();

    // Request desktop notification permission if not yet prompted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // Subscribe to incoming remote mobile SOS alerts
    const unsubscribe = subscribeToEmergencyAlerts((incomingAlert) => {
      if (!isAdminRef.current) return;
      console.log('🚨 REAL-TIME SOS RECEIVED ON OPERATOR TERMINAL:', incomingAlert);
      triggerEmergencyAlert(incomingAlert);
    });

    // Also listen to local ser_emergency_sos custom events
    const handleDirectSos = (e) => {
      if (!e.detail) return;
      const isOwnerAdmin = (typeof window !== 'undefined' && localStorage.getItem('ser_owner_device') === 'true') || isAdminRef.current;
      if (!isOwnerAdmin) return;
      triggerEmergencyAlert(e.detail);
    };
    window.addEventListener('ser_emergency_sos', handleDirectSos);

    // Also listen for cross-tab storage changes
    const handleStorageChange = (e) => {
      if (e.key === 'ser_active_sos' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const isOwnerAdmin = (typeof window !== 'undefined' && localStorage.getItem('ser_owner_device') === 'true') || isAdminRef.current;
          if (isOwnerAdmin && parsed && parsed.id && !isAlertDismissed(parsed.id)) {
            triggerEmergencyAlert(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      unsubscribe();
      window.removeEventListener('ser_emergency_sos', handleDirectSos);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [getResponderLocation, triggerEmergencyAlert]);

  // Manual Dismissal by Admin Click
  const handleDismiss = () => {
    stopEmergencySiren();
    if (activeAlert?.id) {
      markAlertDismissed(activeAlert.id);
    }
    activeAlertRef.current = null;
    setActiveAlert(null);
    setIsMuted(true);
    setIsPhotoModalOpen(false);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      enableSiren(true);
      startEmergencySiren();
      setIsMuted(false);
    } else {
      stopEmergencySiren();
      setIsMuted(true);
    }
  };

  const handleViewOnLiveMap = () => {
    stopEmergencySiren();
    const lat = activeAlert?.latitude;
    const lng = activeAlert?.longitude;
    const alertId = activeAlert?.id;
    activeAlertRef.current = null;
    setActiveAlert(null);
    setIsPhotoModalOpen(false);
    if (lat && lng) {
      navigate(`/map?focusLat=${lat}&focusLng=${lng}&incidentId=${encodeURIComponent(alertId || '')}&route=true`);
    } else {
      navigate('/map');
    }
  };

  // Close modal popup and silence siren when user navigates to another page,
  // but NEVER DELETE the active alert from system/map/alerts list
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      if (activeAlertRef.current) {
        stopEmergencySiren();
        activeAlertRef.current = null;
        setActiveAlert(null);
        setIsMuted(true);
        setIsPhotoModalOpen(false);
      }
    }
  }, [location.pathname]);

  // Render whenever there is an active alert (except citizen SOS page or for viewer)
  if (!isAdmin || isViewer || !activeAlert || location.pathname === '/sos' || location.pathname === '/citizen') {
    return null;
  }

  const typeIcons = {
    Medical: Ambulance,
    Police: Shield,
    Fire: Flame,
    Traffic: AlertTriangle,
  };
  const distressType = activeAlert.emergencyType || activeAlert.type || (
    activeAlert.notes && /traffic|crash|collision/i.test(activeAlert.notes) ? 'Traffic' :
    activeAlert.notes && /police|crime/i.test(activeAlert.notes) ? 'Police' :
    activeAlert.notes && /fire/i.test(activeAlert.notes) ? 'Fire' :
    activeAlert.notes && /medical|ambulance|health/i.test(activeAlert.notes) ? 'Medical' :
    'Medical'
  );
  const AlertIcon = typeIcons[distressType] || Ambulance;

  // Remote Citizen phone takes first priority
  const remotePhone = (!isDummyPhoneNumber(activeAlert.reporter_phone) ? activeAlert.reporter_phone : '') ||
                      (!isDummyPhoneNumber(activeAlert.phone) ? activeAlert.phone : '') ||
                      (typeof window !== 'undefined' ? (localStorage.getItem('ser_user_phone') || '') : '');
  const callerPhone = remotePhone || cleanPhoneNumber('', activeAlert.id);
  const hasValidPhone = Boolean(callerPhone && callerPhone.length > 5);

  // Remote Citizen photo takes first priority with fallback to local cache
  const displayPhoto = activeAlert.photo ||
    activeAlert.photo_url ||
    activeAlert.thumbnail ||
    (typeof window !== 'undefined' ? (
      localStorage.getItem(`ser_sos_photo_${activeAlert.id}`) ||
      localStorage.getItem('ser_user_uploaded_photo') ||
      localStorage.getItem('ser_latest_sos_photo') ||
      null
    ) : null);

  const cleanDisplayAddress = cleanLocation(activeAlert.address);

  const rawOpLat = Number(responderLocation?.lat);
  const rawOpLng = Number(responderLocation?.lng);
  const safeOpLat = (Number.isFinite(rawOpLat) && rawOpLat !== 0) ? rawOpLat : 13.0827;
  const safeOpLng = (Number.isFinite(rawOpLng) && rawOpLng !== 0) ? rawOpLng : 80.2707;

  const rawUserLat = Number(activeAlert.latitude);
  const rawUserLng = Number(activeAlert.longitude);
  const safeUserLat = (Number.isFinite(rawUserLat) && rawUserLat !== 0) ? rawUserLat : 11.3410;
  const safeUserLng = (Number.isFinite(rawUserLng) && rawUserLng !== 0) ? rawUserLng : 77.7172;

  const directDistanceKm = haversineDistance(safeOpLat, safeOpLng, safeUserLat, safeUserLng);
  const etaMinutes = directDistanceKm ? Math.max(1, Math.round((parseFloat(directDistanceKm) / 38) * 60)) : null;

  // Google Maps Turn-by-Turn Navigation URL
  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${safeOpLat},${safeOpLng}&destination=${safeUserLat},${safeUserLng}&travelmode=driving`;

  return (
    <ModalErrorBoundary fallback={null}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
        {/* Outer pulsing red glow */}
        <div className="absolute inset-0 pointer-events-none bg-rose-600/20 animate-pulse" />

        <div className="relative w-full max-w-lg my-auto rounded-3xl bg-slate-900 border-2 border-rose-500 shadow-2xl shadow-rose-950/90 overflow-hidden text-white animate-scaleUp max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-600 to-red-600 px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center animate-bounce">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-wider uppercase text-white font-mono flex items-center gap-1.5">
                  <span>EMERGENCY SOS ALERT</span>
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Audio Mute / Unmute */}
              <button
                type="button"
                onClick={handleToggleMute}
                className={`p-2 rounded-xl border transition-all ${
                  isMuted
                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                    : 'bg-white text-rose-600 border-white shadow-md animate-pulse'
                }`}
                title={isMuted ? 'Unmute Siren Alarm' : 'Mute Siren Alarm'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleDismiss}
                className="p-2 rounded-xl bg-black/30 hover:bg-black/50 text-white transition-colors"
                title="Dismiss Alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
            {/* 1. DISTRESS TYPE & PRIORITY */}
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                  <AlertIcon className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    DISTRESS TYPE
                  </span>
                  <span className="text-base font-black text-rose-300">
                    {distressType} Emergency
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-mono font-bold uppercase border border-rose-500/40 animate-pulse">
                CRITICAL PRIORITY
              </span>
            </div>

            {/* 2. VERIFIED LIVE ACCIDENT CAMERA PHOTO (CONFIRMATION PROOF) */}
            {displayPhoto ? (
              <div className="p-3 rounded-2xl bg-slate-850 border-2 border-emerald-500/40 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between pb-2 border-b border-slate-750">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold font-mono text-emerald-300 uppercase tracking-wider">
                      Verified Live Accident Photo
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    CAMERA PROOF
                  </span>
                </div>

                <div
                  className="relative mt-2 rounded-xl overflow-hidden bg-black group cursor-pointer"
                  onClick={() => setIsPhotoModalOpen(true)}
                >
                  <img
                    src={displayPhoto}
                    alt="Accident scene camera proof"
                    className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      if (activeAlert?.thumbnail && e.currentTarget.src !== activeAlert.thumbnail) {
                        e.currentTarget.src = activeAlert.thumbnail;
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex flex-col justify-between p-2.5 pointer-events-none">
                    <div className="flex justify-end">
                      <div className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-[10px] font-mono text-white flex items-center gap-1 border border-white/20">
                        <ZoomIn className="w-3 h-3 text-emerald-400" />
                        <span>Tap to Enlarge</span>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-200">
                      <span>Live Snapshot from Citizen Device</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs text-slate-400 font-mono">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-slate-500" />
                  <span>No live photo captured by user</span>
                </div>
                <span className="text-[10px] text-slate-500">Telemetry only</span>
              </div>
            )}

            {/* 3. TACTICAL GPS RADAR & ROUTE NAVIGATION HUD */}
            <div className="rounded-2xl border-2 border-sky-500/40 bg-gradient-to-b from-slate-900 via-slate-850 to-slate-900 overflow-hidden shadow-xl">
              {/* Tactical Header Strip */}
              <div className="bg-slate-800/90 px-3.5 py-2.5 flex items-center justify-between border-b border-sky-500/30">
                <div className="flex items-center gap-2">
                  <div className="relative w-3 h-3 flex items-center justify-center">
                    <span className="absolute w-full h-full rounded-full bg-sky-400 animate-ping opacity-75" />
                    <span className="relative w-2 h-2 rounded-full bg-sky-400" />
                  </div>
                  <span className="text-xs font-bold font-mono text-sky-300 uppercase tracking-wider flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5 text-sky-400" />
                    <span>Tactical GPS Navigation</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  {directDistanceKm && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold shadow-sm">
                      {directDistanceKm} km
                    </span>
                  )}
                  {etaMinutes && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1 shadow-sm">
                      <Clock className="w-3 h-3" />
                      ~{etaMinutes} min ETA
                    </span>
                  )}
                </div>
              </div>

              {/* Tactical Route Visualizer */}
              <div className="p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {/* Origin */}
                  <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700">
                    <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">YOUR POSITION</span>
                    </div>
                    <p className="text-slate-300 font-semibold text-[11px] truncate">
                      {safeOpLat.toFixed(4)}° N, {safeOpLng.toFixed(4)}° E
                    </p>
                  </div>

                  {/* Destination */}
                  <div className="p-2 rounded-xl bg-slate-800/60 border border-rose-500/30">
                    <div className="flex items-center gap-1.5 text-rose-400 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">INCIDENT SCENE</span>
                    </div>
                    <p className="text-slate-300 font-semibold text-[11px] truncate">
                      {safeUserLat.toFixed(4)}° N, {safeUserLng.toFixed(4)}° E
                    </p>
                  </div>
                </div>

                {/* Tactical Dispatch Direct Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleViewOnLiveMap}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs font-mono flex items-center justify-center gap-1.5 shadow-md shadow-sky-950/50 transition-all active:scale-95"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>View on SER Map &rarr;</span>
                  </button>

                  <a
                    href={googleMapsDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-sky-300 hover:text-white border border-slate-700 font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Google Directions</span>
                  </a>
                </div>
              </div>
            </div>

            {/* 4. CITIZEN ACCIDENT LOCATION (PLACE ONLY) */}
            <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-1">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-5 h-5 text-amber-400 animate-bounce" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    விபத்து இடம் / துல்லியமான முகவரி (LOCATION)
                  </span>
                  <p className="text-xs font-semibold text-slate-200 mt-0.5 leading-snug">
                    {cleanDisplayAddress}
                  </p>
                </div>
              </div>
            </div>

            {/* 5. CITIZEN SITUATION NOTES (குறிப்புகள்) */}
            {activeAlert.notes && String(activeAlert.notes).trim() !== '' && String(activeAlert.notes) !== String(activeAlert.address) && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-bold">
                    விபத்து விவரம் / CITIZEN REPORT NOTES
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-100 leading-relaxed pl-1 whitespace-pre-wrap">
                  "{String(activeAlert.notes)}"
                </p>
              </div>
            )}

            {/* 6. CITIZEN PHONE NUMBER */}
            <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <PhoneCall className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    CALLER CONTACT
                  </span>
                  <span className="text-sm font-mono font-bold text-white">
                    {callerPhone}
                  </span>
                </div>
              </div>

              {hasValidPhone && (
                <a
                  href={`tel:${callerPhone}`}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono flex items-center gap-1 shadow-md transition-colors"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Citizen</span>
                </a>
              )}
            </div>

            {/* 7. ACTION BUTTONS: OPEN ON FULL MAP & DISMISS SIREN */}
            <div className="pt-1 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleViewOnLiveMap}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-950/60 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open On Full Map</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span>Dismiss Siren</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Photo Lightbox Modal */}
      {isPhotoModalOpen && displayPhoto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-fadeIn">
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-3xl border-2 border-emerald-500/50 overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-850 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase">
                  Accident Scene Photo Evidence
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 flex items-center justify-center bg-black max-h-[75vh]">
              <img
                src={displayPhoto}
                alt="Full size accident scene evidence"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>

            <div className="p-3 bg-slate-850 border-t border-slate-700 flex items-center justify-between text-xs font-mono text-slate-300">
              <span>Coordinates: {safeUserLat.toFixed(4)}° N, {safeUserLng.toFixed(4)}° E</span>
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(false)}
                className="px-3 py-1 rounded-lg bg-slate-700 text-white font-bold text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalErrorBoundary>
  );
};
