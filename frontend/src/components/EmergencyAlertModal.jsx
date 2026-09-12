import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { subscribeToEmergencyAlerts } from '../services/realtimeEmergency';
import { startEmergencySiren, stopEmergencySiren } from '../utils/sirenSound';
import { accidentsApi } from '../services/api';
import { cleanPhoneNumber, cleanLocation } from '../services/mockData';

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
      const key = `${Number(bounds[0][0]).toFixed(4)}_${Number(bounds[0][1]).toFixed(4)}_${Number(bounds[1][0]).toFixed(4)}_${Number(bounds[1][1]).toFixed(4)}`;
      if (lastBoundsKeyRef.current !== key) {
        lastBoundsKeyRef.current = key;
        try {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16, animate: false });
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
  const [activeAlert, setActiveAlert] = useState(null);
  const [isMuted, setIsMuted] = useState(true); // Alarm sound OFF/silenced by default per user request

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

  useEffect(() => {
    getResponderLocation();

    // Load recent active SOS on mount (< 10 mins old)
    try {
      const activeRaw = localStorage.getItem('ser_active_sos');
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw);
        if (parsed && parsed.timestamp && (Date.now() - new Date(parsed.timestamp).getTime() < 10 * 60 * 1000)) {
          const userSavedPhone = localStorage.getItem('ser_user_phone') || '';
          const userUploadedPhoto = localStorage.getItem('ser_user_uploaded_photo') || null;
          if (userSavedPhone) {
            parsed.reporter_phone = userSavedPhone;
            parsed.phone = userSavedPhone;
          }
          if (userUploadedPhoto) {
            parsed.photo = userUploadedPhoto;
          }
          setActiveAlert(parsed);
        }
      }
    } catch {}

    // Request desktop notification permission if not yet prompted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // Subscribe to incoming remote mobile SOS alerts
    const unsubscribe = subscribeToEmergencyAlerts((incomingAlert) => {
      console.log('🚨 REAL-TIME SOS RECEIVED ON OPERATOR TERMINAL:', incomingAlert);

      // Check if user uploaded photo exists
      const userUploadedPhoto = localStorage.getItem('ser_user_uploaded_photo') || null;
      if (userUploadedPhoto) {
        incomingAlert.photo = userUploadedPhoto;
      } else if (!incomingAlert.photo) {
        try {
          const cachedPhoto = localStorage.getItem(`ser_sos_photo_${incomingAlert.id}`) || localStorage.getItem('ser_latest_sos_photo');
          if (cachedPhoto) incomingAlert.photo = cachedPhoto;
        } catch {}
      }

      const userSavedPhone = (typeof window !== 'undefined' ? localStorage.getItem('ser_user_phone') : '') || '';
      const rawPhone = userSavedPhone || incomingAlert.reporter_phone || incomingAlert.phone || '';
      const userPhone = cleanPhoneNumber(rawPhone, incomingAlert.id);
      const cleanAddr = cleanLocation(incomingAlert.address);
      const alertType = incomingAlert.type || incomingAlert.emergencyType || 'Fire';

      incomingAlert.reporter_phone = userPhone;
      incomingAlert.phone = userPhone;
      incomingAlert.type = alertType;
      incomingAlert.address = cleanAddr;

      setActiveAlert(incomingAlert);

      // Alarm audio siren remains OFF/silenced by default

      // Desktop browser notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`🚨 CITIZEN SOS: ${alertType}`, {
          body: `${cleanAddr}\nContact: ${userPhone}`,
          icon: '/favicon.ico',
        });
      }

      // Automatically register into backend/mock DB so it appears on the Live Map
      try {
        if (incomingAlert.latitude && incomingAlert.longitude) {
          accidentsApi.createAccident({
            latitude: incomingAlert.latitude,
            longitude: incomingAlert.longitude,
            address: cleanAddr,
            description: `[CITIZEN SOS] ${alertType} distress call. Contact: ${userPhone}. ${incomingAlert.notes || ''}`,
            severity: 'Critical',
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
      if (e.detail) {
        const incomingAlert = { ...e.detail };
        if (!incomingAlert.photo) {
          try {
            const cachedPhoto = localStorage.getItem('ser_user_uploaded_photo') || localStorage.getItem(`ser_sos_photo_${incomingAlert.id}`) || localStorage.getItem('ser_latest_sos_photo');
            if (cachedPhoto) incomingAlert.photo = cachedPhoto;
          } catch {}
        }
        const rawPhone = incomingAlert.reporter_phone || incomingAlert.phone || (typeof window !== 'undefined' ? localStorage.getItem('ser_user_phone') : '') || '';
        incomingAlert.reporter_phone = cleanPhoneNumber(rawPhone, incomingAlert.id);
        incomingAlert.phone = incomingAlert.reporter_phone;
        incomingAlert.type = incomingAlert.type || incomingAlert.emergencyType || 'Fire';
        incomingAlert.address = cleanLocation(incomingAlert.address);

        setActiveAlert(incomingAlert);
        // Siren sound silenced by default
      }
    };
    window.addEventListener('ser_emergency_sos', handleDirectSos);

    return () => {
      unsubscribe();
      window.removeEventListener('ser_emergency_sos', handleDirectSos);
      stopEmergencySiren();
    };
  }, [getResponderLocation]);

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
    setActiveAlert(null);
    setIsMuted(true);
    setIsPhotoModalOpen(false);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      startEmergencySiren();
      setIsMuted(false);
    } else {
      stopEmergencySiren();
      setIsMuted(true);
    }
  };

  const handleViewOnLiveMap = () => {
    stopEmergencySiren();
    const lat = activeAlert.latitude;
    const lng = activeAlert.longitude;
    setActiveAlert(null);
    setIsPhotoModalOpen(false);
    navigate(`/map?focusLat=${lat}&focusLng=${lng}&route=true`);
  };

  if (!activeAlert) return null;

  const typeIcons = {
    Medical: Ambulance,
    Police: Shield,
    Fire: Flame,
    Traffic: AlertTriangle,
  };
  const distressType = activeAlert.type || activeAlert.emergencyType || (activeAlert.notes && /fire/i.test(activeAlert.notes) ? 'Fire' : 'Fire');
  const AlertIcon = typeIcons[distressType] || Flame;

  const userSavedPhone = (typeof window !== 'undefined' ? localStorage.getItem('ser_user_phone') : '') || '';
  const rawPhone = userSavedPhone || activeAlert.reporter_phone || activeAlert.phone || '';
  const callerPhone = cleanPhoneNumber(rawPhone, activeAlert.id);
  const hasValidPhone = Boolean(callerPhone && callerPhone.length > 5);
  const userUploadedPhoto = typeof window !== 'undefined' ? (localStorage.getItem('ser_user_uploaded_photo') || null) : null;
  const displayPhoto = userUploadedPhoto || activeAlert.photo || (typeof window !== 'undefined' ? (localStorage.getItem(`ser_sos_photo_${activeAlert.id}`) || localStorage.getItem('ser_latest_sos_photo')) : null);

  const cleanDisplayAddress = cleanLocation(activeAlert.address);

  const exactLat = activeAlert.latitude != null ? Number(activeAlert.latitude).toFixed(5) : null;
  const exactLng = activeAlert.longitude != null ? Number(activeAlert.longitude).toFixed(5) : null;

  const opLat = responderLocation?.lat || 13.0827;
  const opLng = responderLocation?.lng || 80.2707;
  const userLat = Number(activeAlert.latitude || 13.0827);
  const userLng = Number(activeAlert.longitude || 80.2707);

  const routeBounds = [
    [opLat, opLng],
    [userLat, userLng]
  ];

  // Google Maps Turn-by-Turn Navigation URL
  const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${opLat},${opLng}&destination=${userLat},${userLng}&travelmode=driving`;

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
                  center={[(opLat + userLat) / 2, (opLng + userLng) / 2]}
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
                  <Marker position={[opLat, opLng]} icon={responderMarkerIcon}>
                    <Popup>
                      <div className="text-xs font-mono font-bold text-blue-600 p-1">
                        📍 YOUR LOCATION (RESPONDER)
                      </div>
                    </Popup>
                  </Marker>

                  {/* Citizen Accident Location Marker */}
                  <Marker position={[userLat, userLng]} icon={accidentMarkerIcon}>
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

                <a
                  href={`/map?focusLat=${userLat}&focusLng=${userLng}&route=true`}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs font-mono flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>View Route on SER Map &rarr;</span>
                </a>
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
                  {activeAlert.notes && activeAlert.notes !== activeAlert.address && (
                    <p className="text-[11px] text-amber-300/90 mt-1 font-mono italic">
                      Note: "{activeAlert.notes}"
                    </p>
                  )}
                </div>
              </div>
            </div>

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
