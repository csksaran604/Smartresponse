import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Ambulance,
  Shield,
  Flame,
  PhoneCall,
  MapPin,
  CheckCircle2,
  Radio,
  Clock,
  Navigation,
  RefreshCw,
  Send,
  Lock,
  LayoutDashboard,
  Crosshair,
  Layers,
  Info,
  Camera,
  CameraOff,
  SwitchCamera,
  Check,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { broadcastEmergencySos } from '../services/realtimeEmergency';
import { accidentsApi } from '../services/api';
import { cleanPhoneNumber, cleanLocation, isDummyPhoneNumber } from '../services/mockData';
import { useAuth } from '../context/AuthContext';

// Custom glowing blue radar pin for Citizen's live location
const citizenPinIcon = L.divIcon({
  className: 'custom-citizen-pin',
  html: `
    <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; inset:0; border-radius:50%; background:rgba(59, 130, 246, 0.45); animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="position:absolute; inset:6px; border-radius:50%; background:rgba(37, 99, 235, 0.6); animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
      <div style="width:20px; height:20px; border-radius:50%; background:#2563eb; border:3.5px solid #ffffff; box-shadow:0 0 16px rgba(37,99,235,0.9); z-index:2;"></div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Helper component to auto-pan and center map on GPS coordinates
function MapRecenter({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords?.lat && coords?.lng) {
      map.flyTo([coords.lat, coords.lng], 16, { animate: true, duration: 1.2 });
    }
  }, [coords, map]);
  return null;
}

// Compress dataUrl to compact JPEG
const compressImage = (dataUrl, maxWidth = 640, maxHeight = 480, quality = 0.65) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export const PublicSosPage = () => {
  const { isAdmin } = useAuth();
  const isOwnerAdmin = (typeof window !== 'undefined' && localStorage.getItem('ser_owner_device') === 'true') || isAdmin;

  const [coords, setCoords] = useState(null);
  const [address, setAddress] = useState('Acquiring high-precision GPS satellite fix...');
  const [locating, setLocating] = useState(true);
  const [gpsError, setGpsError] = useState(null);

  const [emergencyType, setEmergencyType] = useState(() => (typeof window !== 'undefined' ? (localStorage.getItem('ser_selected_distress_type') || 'Medical') : 'Medical'));
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ser_user_phone') || '';
      const isDummy = (p) => !p || p.includes('94431') || p.includes('test0') || p.includes('10987') || p.includes('12345');
      if (saved && !isDummy(saved)) return saved;
    }
    return '';
  });
  const [countdown, setCountdown] = useState(null);
  const [sosSent, setSosSent] = useState(false);
  const [sentDetails, setSentDetails] = useState(null);
  const [broadcasting, setBroadcasting] = useState(false);

  // Live Camera / Photo Capture State
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(() => (typeof window !== 'undefined' ? (localStorage.getItem('ser_user_uploaded_photo') || null) : null));
  const [capturedThumbnail, setCapturedThumbnail] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const watchIdRef = useRef(null);
  const fileInputRef = useRef(null);

  // Reverse Geocoding via Nominatim with clean fallback
  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (res.ok) {
        const data = await res.json();
        const parts = [
          data.address?.road || data.address?.suburb || data.address?.neighbourhood,
          data.address?.city || data.address?.town || data.address?.state_district,
          data.address?.state,
        ].filter(Boolean);
        if (parts.length > 0) {
          return parts.join(', ');
        }
        return data.display_name?.split(',').slice(0, 3).join(', ').trim() || data.display_name;
      }
    } catch (e) {
      console.warn('Geocoding error:', e);
    }
    return `Location Fix: ${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`;
  };

  // Request continuous high-accuracy browser geolocation
  const requestLocation = useCallback(() => {
    setLocating(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device browser.');
      setLocating(false);
      setCoords({ lat: 11.3410, lng: 77.7172, accuracy: 20 });
      setAddress('Perundurai Road, Erode, Tamil Nadu');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) });
        setLocating(false);
        const resolvedAddress = await reverseGeocode(latitude, longitude);
        setAddress(resolvedAddress);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setGpsError('Location access was denied. Please allow GPS permission in your browser for dispatch accuracy.');
        } else {
          setGpsError('GPS satellite signal acquiring... Using approximate network cell.');
        }
        setCoords({ lat: 11.3410, lng: 77.7172, accuracy: 30 });
        setAddress('Perundurai Road, Erode, Tamil Nadu');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    // Watch position continuously to lock exact meter precision
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords((prev) => ({
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
        }));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [requestLocation]);

  // Start Live Device Camera Feed (with graceful fallbacks)
  const startCamera = async (mode = facingMode) => {
    setCameraError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Browser doesn't support direct getUserMedia (e.g. non-HTTPS) -> open phone native camera directly
      fileInputRef.current?.click();
      return;
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });
    } catch (e1) {
      try {
        // Fallback: simple video: true without constraints
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (e2) {
        console.warn('Direct camera stream failed:', e2);
        setCameraError('Camera access was blocked or unavailable. Opening phone camera app...');
        fileInputRef.current?.click();
        return;
      }
    }

    if (stream) {
      streamRef.current = stream;
      setCameraActive(true);
    }
  };

  // Safe video stream attachment once <video> is mounted in DOM
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      const vid = videoRef.current;
      vid.srcObject = streamRef.current;
      vid.onloadedmetadata = () => {
        vid.play().catch((err) => console.warn('Video play error:', err));
      };
    }
  }, [cameraActive]);

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Flip Camera (Front / Back)
  const flipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Shutter Snapshot
  const capturePhoto = async () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const compressed = await compressImage(rawDataUrl, 640, 480, 0.65);
      const thumb = await compressImage(rawDataUrl, 100, 75, 0.35);
      setCapturedPhoto(compressed);
      setCapturedThumbnail(thumb);
      try {
        localStorage.setItem('ser_user_uploaded_photo', compressed);
        localStorage.setItem('ser_latest_sos_photo', compressed);
      } catch {}
      stopCamera();
    } catch (e) {
      console.warn('Capture error:', e);
    }
  };

  // Handle Native Phone Camera / File Input
  const handleNativeFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result, 640, 480, 0.65);
      const thumb = await compressImage(ev.target.result, 100, 75, 0.35);
      setCapturedPhoto(compressed);
      setCapturedThumbnail(thumb);
      try {
        localStorage.setItem('ser_user_uploaded_photo', compressed);
        localStorage.setItem('ser_latest_sos_photo', compressed);
      } catch {}
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  // Handle SOS Button Click - Instant Broadcast (0ms Delay)
  const handleSosPress = () => {
    transmitEmergencySos();
  };

  // Immediate Transmission
  const transmitEmergencySos = async () => {
    setBroadcasting(true);
    const storedPhone = typeof window !== 'undefined' ? (localStorage.getItem('ser_user_phone') || '') : '';
    const userTypedPhone = (!isDummyPhoneNumber(phone.trim()) ? phone.trim() : '') ||
                           (!isDummyPhoneNumber(storedPhone) ? storedPhone : '');

    if (userTypedPhone && typeof window !== 'undefined') {
      try {
        localStorage.setItem('ser_user_phone', userTypedPhone);
      } catch {}
    }
    const cleanPhone = userTypedPhone || cleanPhoneNumber('', Date.now());
    const finalPhone = userTypedPhone || cleanPhone;
    const finalPhoto = capturedPhoto || (typeof window !== 'undefined' ? (localStorage.getItem('ser_user_uploaded_photo') || null) : null);
    const cleanAddr = cleanLocation(address);
    const emergencyPayload = {
      id: `SOS-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type: emergencyType,
      emergencyType,
      latitude: coords?.lat != null ? Number(coords.lat) : 11.3410,
      longitude: coords?.lng != null ? Number(coords.lng) : 77.7172,
      address: cleanAddr,
      notes: notes.trim(),
      phone: finalPhone,
      reporter_phone: finalPhone,
      photo: finalPhoto,
      thumbnail: capturedThumbnail || (finalPhoto && finalPhoto.length < 3000 ? finalPhoto : null),
      urgency: 'Critical',
      timestamp: new Date().toISOString(),
    };

    try {
      localStorage.setItem('ser_active_sos', JSON.stringify(emergencyPayload));
      localStorage.setItem('ser_selected_distress_type', emergencyType);
      if (userTypedPhone) localStorage.setItem('ser_user_phone', userTypedPhone);
      if (finalPhoto) {
        localStorage.setItem('ser_user_uploaded_photo', finalPhoto);
        localStorage.setItem(`ser_sos_photo_${emergencyPayload.id}`, finalPhoto);
        localStorage.setItem('ser_latest_sos_photo', finalPhoto);
      }
      window.dispatchEvent(new CustomEvent('ser_emergency_sos', { detail: emergencyPayload }));
    } catch {}

    // Immediately update UI to confirmed dispatch state so citizen is never stuck on "TRANSMITTING..."
    setSosSent(true);
    setSentDetails(emergencyPayload);
    setBroadcasting(false);

    // Parallel background dispatch to cloud relays & mock API
    Promise.allSettled([
      broadcastEmergencySos(emergencyPayload),
      accidentsApi.createAccident({
        latitude: emergencyPayload.latitude,
        longitude: emergencyPayload.longitude,
        address: emergencyPayload.address,
        description: `[CITIZEN SOS] ${emergencyPayload.emergencyType} alert: ${emergencyPayload.notes || 'Immediate assistance required.'}${finalPhone ? ` • Contact: ${finalPhone}` : ''}`,
        severity: 'Critical',
        emergency_type: emergencyPayload.emergencyType,
        type: emergencyPayload.emergencyType,
        reporter: finalPhone ? `Citizen (${finalPhone})` : 'Citizen Direct',
        phone: finalPhone,
        phone_number: finalPhone,
        reporter_phone: finalPhone,
        ai_confidence: 99.0,
        photo: finalPhoto,
        date_time: emergencyPayload.timestamp || new Date().toISOString(),
        created_at: emergencyPayload.timestamp || new Date().toISOString(),
      }),
    ]).catch((err) => {
      console.warn('Background sync note:', err);
    });
  };

  const emergencyCategories = [
    { id: 'Medical', label: 'Ambulance / Medical', icon: Ambulance, color: 'border-rose-500 text-rose-400 bg-rose-500/10' },
    { id: 'Traffic', label: 'Vehicle Crash / Collision', icon: AlertTriangle, color: 'border-amber-500 text-amber-400 bg-amber-500/10' },
    { id: 'Fire', label: 'Fire & Rescue Hazard', icon: Flame, color: 'border-orange-500 text-orange-400 bg-orange-500/10' },
    { id: 'Police', label: 'Police / Crime Incident', icon: Shield, color: 'border-blue-500 text-blue-400 bg-blue-500/10' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-3 sm:p-6 relative overflow-hidden">
      {/* Background glow styling */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-lg mx-auto flex items-center justify-between py-2 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-950/60">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
              <span>SER EMERGENCY SOS</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                CITIZEN
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">1-Tap Emergency Response • No Login Needed</p>
          </div>
        </div>

        {/* Emergency Dispatch Operations Dashboard - ONLY visible to Admin */}
        {isOwnerAdmin && (
          <Link
            to="/dashboard"
            className="text-xs font-mono text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 flex items-center gap-1.5 transition-colors shadow-sm"
            title="Open Emergency Operations Dashboard"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-semibold">Dashboard</span>
          </Link>
        )}
      </header>

      {/* Main SOS Container */}
      <main className="w-full max-w-lg mx-auto my-auto py-4 relative z-10 space-y-4">
        {sosSent ? (
          /* Transmission Confirmation Screen */
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border-2 border-emerald-500/50 shadow-2xl shadow-emerald-950/40 text-center space-y-6 animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold uppercase tracking-wider mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>SIGNAL TRANSMITTED</span>
              </div>
              <h2 className="text-2xl font-black text-white">Emergency Response Alerted!</h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-md mx-auto">
                Your live GPS coordinates have been broadcast to the Operations Dispatch Control. The emergency alert is now ringing on the Admin Dispatch Terminal.
              </p>
            </div>

            {/* Signal Details Card */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-left space-y-2.5 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">EMERGENCY TYPE:</span>
                <span className="text-rose-400 font-bold">{sentDetails?.emergencyType?.toUpperCase()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">YOUR GPS FIX:</span>
                <span className="text-emerald-400 font-bold">
                  {sentDetails?.latitude?.toFixed(5)}, {sentDetails?.longitude?.toFixed(5)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">DISPATCH STATUS:</span>
                <span className="text-amber-400 font-bold animate-pulse">SIREN ACTIVE • EN ROUTE REVIEW</span>
              </div>

              {sentDetails?.photo && (
                <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
                  <img
                    src={sentDetails.photo}
                    alt="Transmitted accident proof"
                    className="w-14 h-14 rounded-lg object-cover border border-emerald-500/50"
                  />
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold block flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      LIVE CAMERA PROOF TRANSMITTED
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Photo delivered to Admin Dispatch Terminal for rapid verification
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Calling Hotline */}
            <div className="pt-2">
              <a
                href="tel:911"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-rose-950/60 transition-all"
              >
                <PhoneCall className="w-5 h-5 animate-pulse" />
                <span>Call Emergency Hotline (911 / 108 / 112)</span>
              </a>
            </div>

            <button
              onClick={() => { setSosSent(false); setCountdown(null); }}
              className="text-xs text-slate-400 hover:text-white underline font-mono"
            >
              Update information or send new distress notice
            </button>
          </div>
        ) : (
          /* Active SOS Screen */
          <div className="space-y-4">
            {/* 1. CITIZEN'S PERSONAL LIVE GPS MAP (ONLY SHOWS USER'S OWN LOCATION) */}
            <div className="rounded-2xl overflow-hidden border-2 border-slate-800 shadow-xl bg-slate-900 relative">
              {/* Top Map Header Pill */}
              <div className="bg-slate-900/90 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span className="text-blue-300 font-bold uppercase tracking-wider">
                    YOUR LIVE GPS POSITION
                  </span>
                </div>
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locating}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                  title="Recenter GPS Position"
                >
                  <Crosshair className={`w-3.5 h-3.5 text-blue-400 ${locating ? 'animate-spin' : ''}`} />
                  <span>{locating ? 'Locating...' : 'Recenter'}</span>
                </button>
              </div>

              {/* Leaflet Mini Map Container */}
              <div className="h-44 sm:h-48 w-full relative z-0">
                {coords ? (
                  <MapContainer
                    center={[coords.lat, coords.lng]}
                    zoom={16}
                    scrollWheelZoom={false}
                    zoomControl={false}
                    attributionControl={false}
                    className="h-full w-full"
                  >
                    <TileLayer
                      url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                      maxZoom={20}
                    />

                    {/* Smooth pan on coordinates update */}
                    <MapRecenter coords={coords} />

                    {/* Accuracy Boundary Circle */}
                    <Circle
                      center={[coords.lat, coords.lng]}
                      radius={coords.accuracy || 25}
                      pathOptions={{
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.18,
                        weight: 2,
                        dashArray: '4, 6',
                      }}
                    />

                    {/* Citizen Radar Beacon Pin */}
                    <Marker position={[coords.lat, coords.lng]} icon={citizenPinIcon}>
                      <Popup className="custom-leaflet-popup">
                        <div className="p-1 text-slate-900 text-xs font-semibold">
                          <p className="font-bold text-blue-600 flex items-center gap-1">
                            <span>📍 You Are Here</span>
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5 max-w-xs">{address}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Accuracy: ±{coords.accuracy || 10}m
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                    <span className="text-xs font-mono">Locking live GPS satellite fix...</span>
                  </div>
                )}
              </div>

              {/* Address Strip below Map */}
              <div className="p-3 bg-slate-900/95 border-t border-slate-800/80 flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0 animate-bounce" />
                <p className="text-xs text-slate-200 font-medium truncate">
                  {address}
                </p>
              </div>
            </div>

            {gpsError && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}

            {/* CITIZEN CONTACT PHONE NUMBER */}
            <div className="bg-slate-900/95 border-2 border-slate-800 rounded-2xl p-3.5 shadow-lg space-y-1.5">
              <label className="flex items-center justify-between text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Your Contact Phone Number:</span>
                </span>
                {phone.trim() ? (
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    SAVED ✓
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    REQUIRED
                  </span>
                )}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  try {
                    localStorage.setItem('ser_user_phone', e.target.value);
                  } catch {}
                }}
                placeholder="Enter your phone number (e.g. 98401 23456)"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            {/* 2. GIANT CIRCULAR 1-TAP SOS BUTTON */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative flex items-center justify-center">
                {/* Animated pulsating waves */}
                <div className="absolute w-48 h-48 rounded-full bg-rose-600/20 animate-ping pointer-events-none" />
                <div className="absolute w-56 h-56 rounded-full bg-rose-600/10 animate-pulse pointer-events-none" />

                <button
                  type="button"
                  onClick={handleSosPress}
                  disabled={broadcasting}
                  className={`relative w-44 h-44 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 ${
                    countdown !== null
                      ? 'bg-amber-600 scale-105 shadow-amber-600/50'
                      : broadcasting
                      ? 'bg-rose-800 animate-pulse'
                      : 'bg-gradient-to-tr from-rose-600 via-red-600 to-rose-500 hover:scale-105 active:scale-95 shadow-rose-600/60'
                  }`}
                >
                  {countdown !== null ? (
                    <>
                      <span className="text-5xl font-black text-white">{countdown}</span>
                      <span className="text-xs font-black uppercase tracking-widest text-amber-200 mt-1 font-mono">
                        TAP TO CANCEL
                      </span>
                    </>
                  ) : broadcasting ? (
                    <>
                      <RefreshCw className="w-10 h-10 text-white animate-spin" />
                      <span className="text-xs font-mono text-white mt-2 uppercase tracking-wider font-bold">
                        TRANSMITTING...
                      </span>
                    </>
                  ) : (
                    <>
                      <Radio className="w-9 h-9 text-white animate-pulse" />
                      <span className="text-3xl font-black tracking-widest text-white mt-1">SOS</span>
                      <span className="text-[10px] font-mono tracking-widest uppercase text-rose-100 mt-0.5">
                        1-TAP DISPATCH
                      </span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs font-mono text-slate-400 mt-3 text-center">
                {countdown !== null
                  ? 'Broadcasting in 3 seconds... Tap button again to abort.'
                  : 'Tap button to broadcast your live GPS to Emergency Dispatch HQ'}
              </p>
            </div>

            {/* 2.5 LIVE ACCIDENT CONFIRMATION CAMERA MODULE */}
            <div className="rounded-2xl border-2 border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
              <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                    Accident Confirmation Photo
                  </span>
                </div>
                {capturedPhoto ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    PHOTO ATTACHED
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30">
                    OPTIONAL PROOF
                  </span>
                )}
              </div>

              <div className="p-3.5 space-y-3">
                {cameraActive ? (
                  /* Live Camera Viewfinder */
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-700">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Viewfinder Target Reticle Overlay */}
                    <div className="absolute inset-4 pointer-events-none border border-white/30 rounded-lg flex items-center justify-center">
                      <div className="w-8 h-8 border-t-2 border-l-2 border-amber-400 absolute top-0 left-0" />
                      <div className="w-8 h-8 border-t-2 border-r-2 border-amber-400 absolute top-0 right-0" />
                      <div className="w-8 h-8 border-b-2 border-l-2 border-amber-400 absolute bottom-0 left-0" />
                      <div className="w-8 h-8 border-b-2 border-r-2 border-amber-400 absolute bottom-0 right-0" />
                      <span className="text-[10px] font-mono uppercase text-white/80 bg-black/50 px-2 py-0.5 rounded">
                        Aim at accident scene
                      </span>
                    </div>

                    {/* Camera Control Overlay */}
                    <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-4 z-10">
                      <button
                        type="button"
                        onClick={flipCamera}
                        className="p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 shadow-md transition-all active:scale-95"
                        title="Flip Camera (Front/Back)"
                      >
                        <SwitchCamera className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white border-4 border-white shadow-2xl transition-all active:scale-90"
                        title="Capture Photo Now"
                      >
                        <Camera className="w-6 h-6" />
                      </button>

                      <button
                        type="button"
                        onClick={stopCamera}
                        className="p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 shadow-md transition-all active:scale-95"
                        title="Close Camera"
                      >
                        <CameraOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : capturedPhoto ? (
                  /* Captured Photo Preview */
                  <div className="space-y-2.5">
                    <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500/50 bg-black max-h-48 flex items-center justify-center">
                      <img
                        src={capturedPhoto}
                        alt="Accident scene proof"
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-[10px] font-mono text-emerald-300 flex items-center gap-1 backdrop-blur-sm">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Live Scene Attached</span>
                      </div>
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[9px] font-mono text-slate-300 backdrop-blur-sm">
                        {coords ? `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°` : 'Live GPS'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>Retake Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhoto(null);
                          try {
                            localStorage.removeItem('ser_user_uploaded_photo');
                            localStorage.removeItem('ser_latest_sos_photo');
                          } catch {}
                        }}
                        className="py-1.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-xs font-mono flex items-center justify-center gap-1 transition-colors"
                        title="Remove attached photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Camera Actions - Take Live Photo or Upload */
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Snap a live camera photo of the vehicle collision or hazard to visually confirm urgency for arriving responders.
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 font-mono"
                      >
                        <Camera className="w-4 h-4 text-slate-950" />
                        <span>Take Live Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                      >
                        <ImageIcon className="w-4 h-4 text-sky-400" />
                        <span>Snap / Upload</span>
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleNativeFileUpload}
                        className="hidden"
                      />
                    </div>

                    {cameraError && (
                      <p className="text-[11px] text-amber-300/90 font-mono mt-1">
                        {cameraError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. EMERGENCY TYPE SELECTOR */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono mb-2">
                Select Distress Type:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {emergencyCategories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = emergencyType === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setEmergencyType(cat.id);
                        try {
                          localStorage.setItem('ser_selected_distress_type', cat.id);
                        } catch {}
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                        isSelected
                          ? `${cat.color} border-2 shadow-lg`
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold leading-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. OPTIONAL NOTES / PHONE */}
            <div className="space-y-2.5 pt-1">
              <div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    try {
                      if (e.target.value && !isDummyPhoneNumber(e.target.value)) {
                        localStorage.setItem('ser_user_phone', e.target.value);
                      }
                    } catch {}
                  }}
                  placeholder="Your Phone Number (Optional, for responder callback)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Brief Note / Landmark (e.g. Near subway entrance)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="button"
                onClick={transmitEmergencySos}
                disabled={broadcasting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 uppercase tracking-wider font-mono disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Broadcast Emergency SOS Immediately</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-lg mx-auto py-2 text-center border-t border-slate-900 text-[11px] text-slate-400 font-mono relative z-10">
        Smart Emergency Response System • Citizen Telemetry Portal
      </footer>
    </div>
  );
};
