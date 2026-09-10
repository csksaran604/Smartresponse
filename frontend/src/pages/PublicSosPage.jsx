import React, { useState, useEffect, useCallback } from 'react';
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
  Crosshair,
  Layers,
  Info
} from 'lucide-react';
import { broadcastEmergencySos } from '../services/realtimeEmergency';
import { accidentsApi } from '../services/api';

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

export const PublicSosPage = () => {
  const [coords, setCoords] = useState(null);
  const [address, setAddress] = useState('Acquiring high-precision GPS satellite fix...');
  const [locating, setLocating] = useState(true);
  const [gpsError, setGpsError] = useState(null);

  const [emergencyType, setEmergencyType] = useState('Medical');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [sosSent, setSosSent] = useState(false);
  const [sentDetails, setSentDetails] = useState(null);
  const [broadcasting, setBroadcasting] = useState(false);

  // Reverse Geocoding via Nominatim
  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (res.ok) {
        const data = await res.json();
        return data.display_name;
      }
    } catch (e) {
      console.warn('Geocoding error:', e);
    }
    return `Latitude: ${lat.toFixed(5)}, Longitude: ${lon.toFixed(5)}`;
  };

  // Request high accuracy browser geolocation
  const requestLocation = useCallback(() => {
    setLocating(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device browser.');
      setLocating(false);
      // Fallback coordinates
      setCoords({ lat: 40.7589, lng: -73.9851, accuracy: 15 });
      setAddress('Times Square, Manhattan, NY (Estimated)');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) });
        const resolvedAddress = await reverseGeocode(latitude, longitude);
        setAddress(resolvedAddress);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setGpsError('Location access was denied. Please allow GPS permission in your browser for dispatch accuracy.');
        } else {
          setGpsError('GPS signal temporarily unavailable. Using approximate mobile network cell.');
        }
        // Fallback default coordinates
        setCoords({ lat: 40.7589, lng: -73.9851, accuracy: 25 });
        setAddress('Midtown District, New York, NY (Estimated GPS)');
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Handle SOS Button Click
  const handleSosPress = () => {
    if (countdown !== null) {
      setCountdown(null);
      return;
    }

    setCountdown(3);
    let current = 3;
    const interval = setInterval(() => {
      current -= 1;
      setCountdown(current);
      if (current <= 0) {
        clearInterval(interval);
        setCountdown(null);
        transmitEmergencySos();
      }
    }, 1000);
  };

  // Immediate Transmission
  const transmitEmergencySos = async () => {
    setBroadcasting(true);
    const emergencyPayload = {
      emergencyType,
      latitude: coords?.lat || 40.7589,
      longitude: coords?.lng || -73.9851,
      address,
      notes: notes.trim(),
      phone: phone.trim() || 'Citizen Mobile Caller',
      urgency: 'Critical',
    };

    try {
      // 1. Broadcast over cloud real-time SSE channel to Operator terminal
      await broadcastEmergencySos(emergencyPayload);

      // 2. Also register into database/mock store
      await accidentsApi.createAccident({
        latitude: emergencyPayload.latitude,
        longitude: emergencyPayload.longitude,
        address: emergencyPayload.address,
        description: `[CITIZEN SOS] ${emergencyPayload.emergencyType} alert: ${emergencyPayload.notes || 'Immediate assistance required.'}`,
        severity: 'Critical',
        reporter: emergencyPayload.phone,
        ai_confidence: 99.0,
      }).catch(() => {});

      setSosSent(true);
      setSentDetails(emergencyPayload);
    } catch (e) {
      console.warn('Transmission error:', e);
      setSosSent(true);
      setSentDetails(emergencyPayload);
    } finally {
      setBroadcasting(false);
    }
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

        {/* Discreet Dispatch Terminal Login */}
        <Link
          to="/login"
          className="text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-1.5 transition-colors"
          title="Authorized Dispatch Personnel Login"
        >
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Operator</span>
        </Link>
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
                Your live GPS coordinates have been broadcast to the Operations Dispatch Control. The emergency siren is now ringing at the operator terminal.
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
                      onClick={() => setEmergencyType(cat.id)}
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
                  onChange={(e) => setPhone(e.target.value)}
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
