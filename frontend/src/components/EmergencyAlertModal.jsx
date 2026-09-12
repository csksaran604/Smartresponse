import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  Maximize2,
  ZoomIn
} from 'lucide-react';
import { subscribeToEmergencyAlerts, isAlertDismissed, markAlertDismissed, checkPendingCloudAlert } from '../services/realtimeEmergency';
import { accidentsApi } from '../services/api';
import { startEmergencySiren, stopEmergencySiren, enableSiren } from '../utils/sirenSound';
import { cleanPhoneNumber, cleanLocation, isDummyPhoneNumber } from '../services/mockData';
import { useAuth } from '../context/AuthContext';

// Custom Map Markers
const accidentMarkerIcon = L.divIcon({
  className: 'accident-marker-pin',
  html: `
    <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; inset:0; border-radius:50%; background:rgba(239, 68, 68, 0.45); animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="width:20px; height:20px; border-radius:50%; background:#ef4444; border:3px solid #ffffff; box-shadow:0 0 14px rgba(239,68,68,1); display:flex; align-items:center; justify-content:center; color:white; font-size:9px; font-weight:900;">!</div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const responderMarkerIcon = L.divIcon({
  className: 'responder-marker-pin',
  html: `
    <div style="position:relative; width:32px; height:32px; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; inset:2px; border-radius:50%; background:rgba(59, 130, 246, 0.4); animation:pulse 1.8s infinite;"></div>
      <div style="width:18px; height:18px; border-radius:50%; background:#3b82f6; border:2.5px solid #ffffff; box-shadow:0 0 12px rgba(59,130,246,0.9);"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Auto fit both responder and accident location
function RouteBoundsFitter({ bounds }) {
  const map = useMap();
  const lastBoundsKeyRef = useRef(null);

  useEffect(() => {
    if (bounds && bounds.length === 2 && bounds[0] && bounds[1]) {
      const b00 = Number(bounds[0][0]);
      const b01 = Number(bounds[0][1]);
      const b10 = Number(bounds[1][0]);
      const b11 = Number(bounds[1][1]);
      if (!Number.isFinite(b00) || !Number.isFinite(b01) || !Number.isFinite(b10) || !Number.isFinite(b11)) return;
      const key = `${b00.toFixed(4)}_${b01.toFixed(4)}_${b10.toFixed(4)}_${b11.toFixed(4)}`;
      if (lastBoundsKeyRef.current !== key) {
        lastBoundsKeyRef.current = key;
        try {
          map.fitBounds([[b00, b01], [b10, b11]], { padding: [30, 30], maxZoom: 16, animate: false });
        } catch {}
      }
    }
  }, [bounds, map]);
  return null;
}

// Distance helper
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
  const { isAdmin } = useAuth();
  const [activeAlert, setActiveAlert] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const activeAlertRef = useRef(null);

  useEffect(() => {
    activeAlertRef.current = activeAlert;
  }, [activeAlert]);

  // Keep ref updated to current role without closure race conditions
  const isAdminRef = useRef(isAdmin);
  useEffect(() => {
    const isOwner = (typeof window !== 'undefined' && localStorage.getItem('ser_owner_device') === 'true') || isAdmin;
    isAdminRef.current = Boolean(isOwner);
  }, [isAdmin]);

  // Operator / Responder Live Location
  const [responderLocation, setResponderLocation] = useState(null);
  // Route state
  const [routePositions, setRoutePositions] = useState([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState(null);
  const [routeDurationMins, setRouteDurationMins] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Fullscreen Photo Lightbox Modal
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // Acquire Operator's Live GPS Location
  const getResponderLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setResponderLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn('Operator GPS notice:', err);
          // Fallback responder location near Chennai center if offline
          setResponderLocation({ lat: 13.0827, lng: 80.2707 });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setResponderLocation({ lat: 13.0827, lng: 80.2707 });
    }
  }, []);

  const triggerEmergencyAlert = useCallback((incomingAlert) => {
    if (!incomingAlert || !incomingAlert.id) return;
    if (isAlertDismissed(incomingAlert.id)) return;

    // If currently displaying this alert, NEVER disrupt, restart siren, or replace state
    if (activeAlertRef.current && (
      String(activeAlertRef.current.id) === String(incomingAlert.id) ||
      (incomingAlert.id && String(activeAlertRef.current.id).includes(String(incomingAlert.id)))
    )) {
      return;
    }

    // The incoming remote mobile citizen's data takes absolute precedence:
    const alertType = incomingAlert.emergencyType || incomingAlert.type || 'Medical';
    const cleanAddr = cleanLocation(incomingAlert.address);

    const remotePhone = (!isDummyPhoneNumber(incomingAlert.reporter_phone) ? incomingAlert.reporter_phone : '') ||
                        (!isDummyPhoneNumber(incomingAlert.phone) ? incomingAlert.phone : '');
    const userPhone = remotePhone || cleanPhoneNumber('', incomingAlert.id);
    const remotePhoto = incomingAlert.photo || incomingAlert.photo_url || null;

    const formattedAlert = {
      ...incomingAlert,
      reporter_phone: userPhone,
      phone: userPhone,
      type: alertType,
      emergencyType: alertType,
      address: cleanAddr,
      photo: remotePhoto,
    };

    setActiveAlert(formattedAlert);

    // Emergency Siren: Audible ONLY for Admin device
    enableSiren(true);
    startEmergencySiren();
    setIsMuted(false);

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

  // Clean up any stale old active alerts on mount so past alerts never pop up
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ser_active_sos');
      if (saved) {
        const parsed = JSON.parse(saved);
        const age = parsed?.timestamp ? Date.now() - new Date(parsed.timestamp).getTime() : Infinity;
        if (age > 15 * 60 * 1000 || isAlertDismissed(parsed?.id)) {
          localStorage.removeItem('ser_active_sos');
        }
      }
    } catch {}
  }, []);

  // Check for freshly submitted reports / SOS sent while admin was logging in
  useEffect(() => {
    const isOwner = (typeof window !== 'undefined' && localStorage.getItem('ser_owner_device') === 'true') || isAdmin;
    if (!isOwner) return;

    const checkForPendingAlerts = async () => {
      // If an alert is already active on admin screen, NEVER clear or interrupt it!
      if (activeAlertRef.current) return;

      // 1. Check local storage for recent undismissed emergency alert (strictly within last 15 minutes)
      try {
        const saved = localStorage.getItem('ser_active_sos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.id && !isAlertDismissed(parsed.id)) {
            const age = parsed.timestamp ? Date.now() - new Date(parsed.timestamp).getTime() : Infinity;
            if (age < 15 * 60 * 1000) {
              triggerEmergencyAlert(parsed);
              return;
            } else {
              // Discard stale alert so it never pops up again
              localStorage.removeItem('ser_active_sos');
            }
          }
        }
      } catch {}

      // 2. Check cloud ntfy relays for any citizen report sent right before admin login (strictly within last 15 minutes)
      try {
        const cloudAlert = await checkPendingCloudAlert();
        if (cloudAlert && cloudAlert.id && !isAlertDismissed(cloudAlert.id)) {
          triggerEmergencyAlert(cloudAlert);
          return;
        }
      } catch {}
    };

    checkForPendingAlerts();
    const interval = setInterval(checkForPendingAlerts, 4000);
    return () => clearInterval(interval);
  }, [isAdmin, triggerEmergencyAlert]);

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
      console.log('🚨 REAL-TIME SOS RECEIVED ON OPERATOR TERMINAL:', incomingAlert);

      // STRICTLY ADMIN TERMINAL ONLY: Citizen mobile or viewer devices must NEVER display this popup modal or play sirens!
      const isOwnerAdmin = (typeof window !== 'undefined' && localStorage.getItem('ser_owner_device') === 'true') || isAdminRef.current;
      if (!isOwnerAdmin) {
        return;
      }

      triggerEmergencyAlert(incomingAlert);

      // Automatically register into backend/mock DB so it appears on the Live Map
      try {
        if (incomingAlert.latitude && incomingAlert.longitude && incomingAlert.source === 'PUBLIC_MOBILE_SOS' && !incomingAlert._registered) {
          incomingAlert._registered = true;
          const cleanAddr = cleanLocation(incomingAlert.address);
          const alertType = incomingAlert.emergencyType || incomingAlert.type || 'Medical';
          const userPhone = incomingAlert.phone || cleanPhoneNumber('', incomingAlert.id);
          accidentsApi.createAccident({
            latitude: incomingAlert.latitude,
            longitude: incomingAlert.longitude,
            address: cleanAddr,
            description: `[CITIZEN SOS] ${alertType} distress call. Contact: ${userPhone}. ${incomingAlert.notes || ''}`,
            severity: 'Critical',
            emergency_type: alertType,
            type: alertType,
            reporter: `Citizen (${userPhone})`,
            phone: userPhone,
            phone_number: userPhone,
            reporter_phone: userPhone,
            ai_confidence: 99.0,
            verification_status: 'Verified',
            photo: incomingAlert.photo || null,
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('Auto-register error:', e);
      }
    });

    // Also listen to local ser_emergency_sos custom events
    const handleDirectSos = (e) => {
      if (!e.detail) return;

      const isOwnerAdmin = (typeof window !== 'undefined' && localStorage.getItem('ser_owner_device') === 'true') || isAdminRef.current;
      if (!isOwnerAdmin) {
        return;
      }

      triggerEmergencyAlert(e.detail);
    };
    window.addEventListener('ser_emergency_sos', handleDirectSos);

    // Also listen for cross-tab storage changes (e.g. user reports in another browser tab)
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
      stopEmergencySiren();
    };
  }, [getResponderLocation, triggerEmergencyAlert]);

  // Fetch real road navigation route (OSRM) between Responder and Accident Scene
  useEffect(() => {
    if (!activeAlert || !activeAlert.latitude || !activeAlert.longitude) return;

    const opLat = responderLocation?.lat || 13.0827;
    const opLng = responderLocation?.lng || 80.2707;
    const targetLat = Number(activeAlert.latitude);
    const targetLng = Number(activeAlert.longitude);

    // Initial geodesic distance
    const directKm = haversineDistance(opLat, opLng, targetLat, targetLng);
    setRouteDistanceKm(directKm);
    setRouteDurationMins(directKm ? Math.max(1, Math.round((parseFloat(directKm) / 35) * 60)) : null);

    setRouteLoading(true);

    // Query OSRM road driving geometry
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${opLng},${opLat};${targetLng},${targetLat}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          // GeoJSON returns [lon, lat], leaflet needs [lat, lon]
          const latLngs = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          setRoutePositions(latLngs);
          setRouteDistanceKm((route.distance / 1000).toFixed(1));
          setRouteDurationMins(Math.max(1, Math.round(route.duration / 60)));
        } else {
          // Fallback straight line
          setRoutePositions([[opLat, opLng], [targetLat, targetLng]]);
        }
      })
      .catch((err) => {
        console.warn('OSRM routing fallback:', err);
        setRoutePositions([[opLat, opLng], [targetLat, targetLng]]);
      })
      .finally(() => {
        setRouteLoading(false);
      });
  }, [activeAlert, responderLocation]);

  const handleDismiss = () => {
    stopEmergencySiren();
    if (activeAlert?.id) {
      markAlertDismissed(activeAlert.id);
    }
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
    if (activeAlert?.id) {
      markAlertDismissed(activeAlert.id);
    }
    const lat = activeAlert?.latitude;
    const lng = activeAlert?.longitude;
    setActiveAlert(null);
    setIsPhotoModalOpen(false);
    if (lat && lng) {
      navigate(`/map?focusLat=${lat}&focusLng=${lng}&route=true`);
    } else {
      navigate('/map');
    }
  };

  const isOwnerAdmin = (typeof window !== 'undefined' && (
    localStorage.getItem('ser_owner_device') === 'true' ||
    localStorage.getItem('ser_user')?.includes('ADMIN') ||
    isAdminRef.current ||
    isAdmin
  ));

  // Never render on citizen SOS page or for non-admin viewers (ALLOWED on /map so alerts appear on live map!)
  if (!isOwnerAdmin || !activeAlert || location.pathname === '/sos' || location.pathname === '/citizen') {
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

  // Remote Citizen phone takes first priority:
  const remotePhone = (!isDummyPhoneNumber(activeAlert.reporter_phone) ? activeAlert.reporter_phone : '') ||
                      (!isDummyPhoneNumber(activeAlert.phone) ? activeAlert.phone : '') ||
                      (typeof window !== 'undefined' ? (localStorage.getItem('ser_user_phone') || '') : '');
  const callerPhone = remotePhone || cleanPhoneNumber('', activeAlert.id);
  const hasValidPhone = Boolean(callerPhone && callerPhone.length > 5);

  // Remote Citizen photo takes first priority with fallback to local cache
  const displayPhoto = activeAlert.photo ||
    activeAlert.photo_url ||
    (typeof window !== 'undefined' ? (
      localStorage.getItem(`ser_sos_photo_${activeAlert.id}`) ||
      localStorage.getItem('ser_user_uploaded_photo') ||
      localStorage.getItem('ser_latest_sos_photo') ||
      null
    ) : null);

  const cleanDisplayAddress = cleanLocation(activeAlert.address);

  const exactLat = activeAlert.latitude != null ? Number(activeAlert.latitude).toFixed(5) : null;
  const exactLng = activeAlert.longitude != null ? Number(activeAlert.longitude).toFixed(5) : null;

  const rawOpLat = Number(responderLocation?.lat);
  const rawOpLng = Number(responderLocation?.lng);
  const safeOpLat = (Number.isFinite(rawOpLat) && rawOpLat !== 0) ? rawOpLat : 13.0827;
  const safeOpLng = (Number.isFinite(rawOpLng) && rawOpLng !== 0) ? rawOpLng : 80.2707;

  const rawUserLat = Number(activeAlert.latitude);
  const rawUserLng = Number(activeAlert.longitude);
  const safeUserLat = (Number.isFinite(rawUserLat) && rawUserLat !== 0) ? rawUserLat : 11.3410;
  const safeUserLng = (Number.isFinite(rawUserLng) && rawUserLng !== 0) ? rawUserLng : 77.7172;

  const routeBounds = [
    [safeOpLat, safeOpLng],
    [safeUserLat, safeUserLng]
  ];

  // Google Maps Turn-by-Turn Navigation URL
  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${safeOpLat},${safeOpLng}&destination=${safeUserLat},${safeUserLng}&travelmode=driving`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
        {/* Outer pulsing glow */}
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
                onClick={handleDismiss}
                className="p-2 rounded-xl bg-black/30 hover:bg-black/50 text-white transition-colors"
                title="Dismiss Alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
            {/* 1. DISTRESS TYPE & SEVERITY */}
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

            {/* 2. CITIZEN LIVE ACCIDENT CAMERA PHOTO (CONFIRMATION PROOF) */}
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

                <div className="relative mt-2 rounded-xl overflow-hidden bg-black group cursor-pointer" onClick={() => setIsPhotoModalOpen(true)}>
                  <img
                    src={displayPhoto}
                    alt="Accident scene camera proof"
                    className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300"
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

            {/* 3. RESPONDER-TO-ACCIDENT NAVIGATION ROUTE MAP */}
            <div className="rounded-2xl border-2 border-slate-700 bg-slate-900 overflow-hidden shadow-xl">
              {/* Route Header Strip */}
              <div className="bg-slate-850 px-3.5 py-2.5 flex items-center justify-between border-b border-slate-700/80">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                    Emergency Route Navigation
                  </span>
                </div>

                {/* Route Distance & ETA Pill */}
                <div className="flex items-center gap-2 font-mono text-xs">
                  {routeDistanceKm && (
                    <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                      {routeDistanceKm} km
                    </span>
                  )}
                  {routeDurationMins && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{routeDurationMins} min ETA
                    </span>
                  )}
                </div>
              </div>

              {/* Embedded Leaflet Route Map */}
              <div className="h-44 w-full relative z-0">
                <MapContainer
                  key={`alert-map-${activeAlert.id || 'current'}`}
                  center={[(safeOpLat + safeUserLat) / 2, (safeOpLng + safeUserLng) / 2]}
                  zoom={14}
                  scrollWheelZoom={false}
                  zoomControl={false}
                  attributionControl={false}
                  className="h-full w-full"
                >
                  <TileLayer
                    url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                    maxZoom={20}
                  />

                  <RouteBoundsFitter bounds={routeBounds} />

                  {/* Route Polyline (Neon Blue/Cyan) */}
                  {routePositions.length > 0 && (
                    <Polyline
                      positions={routePositions}
                      pathOptions={{
                        color: '#0284c7',
                        weight: 5,
                        opacity: 0.9,
                        dashArray: routeLoading ? '8, 8' : undefined,
                      }}
                    />
                  )}

                  {/* Responder Location Marker */}
                  <Marker position={[safeOpLat, safeOpLng]} icon={responderMarkerIcon}>
                    <Popup>
                      <div className="text-xs font-mono font-bold text-blue-600 p-1">
                        📍 YOUR LOCATION (RESPONDER)
                      </div>
                    </Popup>
                  </Marker>

                  {/* Citizen Accident Location Marker */}
                  <Marker position={[safeUserLat, safeUserLng]} icon={accidentMarkerIcon}>
                    <Popup>
                      <div className="text-xs font-mono font-bold text-red-600 p-1">
                        🚨 ACCIDENT LOCATION ({activeAlert.type || 'SOS'})
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>

                {/* Floating Map Legend Indicator */}
                <div className="absolute top-2 left-2 z-[400] px-2 py-1 rounded-md bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-slate-200 backdrop-blur-sm flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> You
                  </span>
                  <span>&rarr;</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Accident
                  </span>
                </div>
              </div>

              {/* Internal SER Live Map Road Navigation */}
              <div className="p-2.5 bg-slate-850 border-t border-slate-700 flex items-center justify-between gap-2">
                <div className="text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-sky-400" />
                  <span>En Route from your live GPS to scene</span>
                </div>

                <button
                  type="button"
                  onClick={handleViewOnLiveMap}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs font-mono flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>View Route on SER Map &rarr;</span>
                </button>
              </div>
            </div>

            {/* 4. CITIZEN ACCIDENT LOCATION (PLACE ONLY) */}
            <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 space-y-2">
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
            {activeAlert.notes && activeAlert.notes !== activeAlert.address && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-bold">
                    விபத்து விவரம் / CITIZEN REPORT NOTES
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-100 leading-relaxed pl-1 whitespace-pre-wrap">
                  "{activeAlert.notes}"
                </p>
              </div>
            )}

            {/* 5. CITIZEN PHONE NUMBER */}
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

            {/* Action Buttons: Open on Map & Dismiss */}
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
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5 active:scale-95"
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
              <span>Coordinates: {exactLat}° N, {exactLng}° E</span>
              <button
                onClick={() => setIsPhotoModalOpen(false)}
                className="px-3 py-1 rounded-lg bg-slate-700 text-white font-bold text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
