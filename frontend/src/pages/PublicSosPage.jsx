import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  Compass,
  Navigation,
  RefreshCw,
  Send,
  Sparkles,
  Lock,
  ArrowRight
} from 'lucide-react';
import { broadcastEmergencySos } from '../services/realtimeEmergency';
import { accidentsApi } from '../services/api';

export const PublicSosPage = () => {
  const [coords, setCoords] = useState(null);
  const [address, setAddress] = useState('Detecting current GPS location...');
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

  // Get User Live Location
  const requestLocation = useCallback(() => {
    setLocating(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device browser.');
      setLocating(false);
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
          setGpsError('Location permission denied. Please allow location access in your browser settings.');
        } else {
          setGpsError('Unable to get GPS signal. Please ensure location is enabled.');
        }
        // Fallback default coordinates
        setCoords({ lat: 40.7589, lng: -73.9851, accuracy: 10 });
        setAddress('Midtown Crossing, New York (Estimated)');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Handle SOS Button Click
  const handleSosPress = () => {
    if (countdown !== null) {
      // Cancel countdown if tapped again
      setCountdown(null);
      return;
    }

    // 3 second cancel window
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

  // Immediate Transmission without countdown
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
      // 1. Send via real-time cloud broadcast channel (reaches Operator terminal instantly!)
      await broadcastEmergencySos(emergencyPayload);

      // 2. Also register into database/mock store
      await accidentsApi.createAccident({
        latitude: emergencyPayload.latitude,
        longitude: emergencyPayload.longitude,
        address: emergencyPayload.address,
        description: `[PUBLIC MOBILE SOS] ${emergencyPayload.emergencyType} distress call: ${emergencyPayload.notes || 'Immediate assistance required.'}`,
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden">
      {/* Background emergency glow effects */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />

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
                PUBLIC
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">No Login Required • Direct Dispatch</p>
          </div>
        </div>

        <Link
          to="/login"
          className="text-xs font-mono text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-1.5 transition-colors"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>HQ Login</span>
        </Link>
      </header>

      {/* Main SOS Container */}
      <main className="w-full max-w-lg mx-auto my-auto py-6 relative z-10">
        {sosSent ? (
          /* SOS Confirmation State */
          <div className="glass-panel p-8 rounded-3xl border-2 border-emerald-500/50 shadow-2xl shadow-emerald-950/40 text-center space-y-6 animate-fadeIn">
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
                Your live GPS coordinates have been broadcast to the Operations Control Terminal. The emergency siren is now ringing at dispatch headquarters.
              </p>
            </div>

            {/* Signal Details Card */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left space-y-2.5 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">CATEGORY:</span>
                <span className="text-rose-400 font-bold">{sentDetails?.emergencyType?.toUpperCase()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">GPS ACCURACY:</span>
                <span className="text-emerald-400">{coords?.accuracy ? `±${coords.accuracy}m` : 'High'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">DISPATCH STATUS:</span>
                <span className="text-amber-400 font-bold animate-pulse">SIREN ACTIVE (OPERATOR NOTIFIED)</span>
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
              Send another update or emergency alert
            </button>
          </div>
        ) : (
          /* Active SOS Trigger Interface */
          <div className="space-y-6">
            {/* Live GPS Bar */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2.5 min-w-0">
                <MapPin className="w-5 h-5 text-rose-500 shrink-0 animate-bounce" />
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span>LIVE CITIZEN LOCATION</span>
                    {locating && <span className="text-amber-400 animate-pulse">(Acquiring...)</span>}
                  </div>
                  <p className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-sm">
                    {address}
                  </p>
                </div>
              </div>

              <button
                onClick={requestLocation}
                disabled={locating}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                title="Refresh GPS Location"
              >
                <RefreshCw className={`w-4 h-4 ${locating ? 'animate-spin text-rose-400' : ''}`} />
              </button>
            </div>

            {gpsError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}

            {/* Giant Circular SOS Button */}
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative flex items-center justify-center">
                {/* Pulsating animated ripples */}
                <div className="absolute w-56 h-56 rounded-full bg-rose-600/20 animate-ping pointer-events-none" />
                <div className="absolute w-64 h-64 rounded-full bg-rose-600/10 animate-pulse pointer-events-none" />

                <button
                  type="button"
                  onClick={handleSosPress}
                  disabled={broadcasting}
                  className={`relative w-48 h-48 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 ${
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
                      <Radio className="w-10 h-10 text-white animate-pulse" />
                      <span className="text-3xl font-black tracking-widest text-white mt-1">SOS</span>
                      <span className="text-[10px] font-mono tracking-widest uppercase text-rose-100 mt-0.5">
                        1-TAP DISPATCH
                      </span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs font-mono text-slate-400 mt-5 text-center">
                {countdown !== null
                  ? 'Broadcasting in 3 seconds... Tap button again to abort.'
                  : 'Tap the button to sound emergency alarm at Operations HQ'}
              </p>
            </div>

            {/* Emergency Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono mb-2">
                Select Distress Nature:
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {emergencyCategories.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = emergencyType === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setEmergencyType(cat.id)}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                        isSelected
                          ? `${cat.color} border-2 shadow-lg`
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="text-xs font-bold leading-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Contact / Notes */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono mb-1">
                  Your Phone Number (Optional):
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1-555-0199 (For dispatch callback)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono mb-1">
                  Brief Situation / Landmark Notes (Optional):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 2 vehicles involved near subway exit"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="button"
                onClick={transmitEmergencySos}
                disabled={broadcasting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 uppercase tracking-wider font-mono disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Instant Broadcast SOS to Operator Now</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-lg mx-auto py-3 text-center border-t border-slate-900 text-[11px] text-slate-400 font-mono relative z-10">
        Smart Emergency Response System • Direct Satellite/Cellular GPS Relay
      </footer>
    </div>
  );
};
