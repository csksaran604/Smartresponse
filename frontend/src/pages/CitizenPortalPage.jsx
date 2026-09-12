import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Ambulance,
  Shield,
  Flame,
  PhoneCall,
  MapPin,
  Camera,
  CheckCircle2,
  Clock,
  Navigation,
  Send,
  Radio,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { accidentsApi, unitsApi, aiApi } from '../services/api';
import { broadcastEmergencySos } from '../services/realtimeEmergency';
import { formatDateTime } from '../utils/dateUtils';

// Helper to compute distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
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
  return (R * c).toFixed(2);
};

export const CitizenPortalPage = () => {
  const { user } = useAuth();
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [units, setUnits] = useState([]);
  const [recentIncidents, setRecentIncidents] = useState([]);

  // SOS state
  const [sosActive, setSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(3);
  const [sosSent, setSosSent] = useState(null);
  const [emergencyType, setEmergencyType] = useState('Medical');
  const [urgency, setUrgency] = useState('Critical');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Photo upload & AI detection
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // Reverse Geocoding
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
      console.warn('Geocode error:', e);
    }
    return `GPS: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  };

  // Get User Live Location
  const locateCitizen = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const address = await reverseGeocode(latitude, longitude);
        setUserLocation({
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          address,
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setGpsError('Location permission denied. Please allow location access to use SOS dispatch.');
        } else {
          setGpsError('Unable to lock GPS location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Fetch Units & User's Recent Reported Incidents
  const loadData = useCallback(async () => {
    try {
      const [uRes, iRes] = await Promise.all([
        unitsApi.getUnits(),
        accidentsApi.getAccidents({ per_page: 10 }),
      ]);
      setUnits(uRes.data.units || []);
      setRecentIncidents(iRes.data.accidents || []);
    } catch (e) {
      console.warn('Failed to load portal data:', e);
    }
  }, []);

  useEffect(() => {
    locateCitizen();
    loadData();
  }, [locateCitizen, loadData]);

  const [base64Photo, setBase64Photo] = useState(null);

  // Handle Photo Selection
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.onload = (ev) => {
      setBase64Photo(ev.target.result);
    };
    reader.readAsDataURL(file);

    setAiAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await aiApi.analyzeImage(formData);
      setAiResult(res.data.detection);
      if (res.data.detection?.severity) {
        setUrgency(res.data.detection.severity);
      }
    } catch (err) {
      console.warn('AI analysis error on citizen upload:', err);
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Instant 1-Click SOS Countdown
  const triggerSosButton = () => {
    if (sosActive) {
      setSosActive(false);
      setSosCountdown(3);
      return;
    }

    setSosActive(true);
    setSosCountdown(3);

    let counter = 3;
    const interval = setInterval(() => {
      counter -= 1;
      setSosCountdown(counter);
      if (counter <= 0) {
        clearInterval(interval);
        setSosActive(false);
        submitEmergencySos();
      }
    }, 1000);
  };

  // Submit Emergency SOS
  const submitEmergencySos = async () => {
    if (!userLocation) {
      alert('Location not ready. Please allow GPS access.');
      return;
    }

    setSubmitting(true);
    try {
      const typeLabels = {
        Medical: '🚨 108 AMBULANCE MEDICAL SOS',
        Traffic: '🚗 CRITICAL ROAD ACCIDENT',
        Fire: '🚒 FIRE & HAZARD EMERGENCY',
        Police: '👮 POLICE / CRIME RESPONSE',
      };

      const payload = {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        address: userLocation.address || `${userLocation.lat}, ${userLocation.lng}`,
        description: notes
          ? `${typeLabels[emergencyType]}: ${notes}`
          : `${typeLabels[emergencyType]} requested at live citizen location.`,
        severity: urgency,
        emergency_type: emergencyType,
        type: emergencyType,
        reporter: user?.full_name || 'Citizen (SOS App)',
        phone: user?.phone || (typeof window !== 'undefined' ? localStorage.getItem('ser_user_phone') : '') || '',
        ai_confidence: aiResult ? aiResult.confidence_score : 98.0,
        detection_id: aiResult ? aiResult.id : null,
        photo: base64Photo || null,
      };

      // Broadcast to real-time emergency operator terminal
      await broadcastEmergencySos({
        type: emergencyType,
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        address: payload.address,
        notes: payload.description,
        phone: user?.phone || user?.full_name || 'Citizen Portal User',
        photo: base64Photo || null,
        urgency,
      }).catch(() => {});

      const res = await accidentsApi.createAccident(payload);
      setSosSent(res.data.accident);
      setNotes('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setBase64Photo(null);
      setAiResult(null);
      loadData();
    } catch (err) {
      console.error('SOS dispatch error:', err);
      alert('SOS Transmission failed. Please dial 108 or 112 immediately.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate distances to units
  const sortedUnits = units
    .map((u) => ({
      ...u,
      dist: userLocation
        ? parseFloat(calculateDistance(userLocation.lat, userLocation.lng, u.latitude, u.longitude))
        : null,
    }))
    .sort((a, b) => (a.dist ?? 99999) - (b.dist ?? 99999));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              Citizen Emergency & SOS Portal
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
              24/7 ACTIVE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Immediate dispatch of Ambulance, Police, and Fire services directly to your live coordinates
          </p>
        </div>

        <Link
          to="/map"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all self-start sm:self-auto"
        >
          <MapPin className="w-4 h-4 text-sky-400" />
          <span>Open Full Tactical Map</span>
        </Link>
      </div>

      {/* GPS Status Banner */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
              <Navigation className={`w-5 h-5 ${locating ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-white font-bold">LIVE CITIZEN LOCATION:</span>
                {userLocation ? (
                  <>
                    <span className="text-emerald-400 font-bold">
                      {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-sky-950 text-sky-300 border border-sky-800">
                      ± {userLocation.accuracy}m
                    </span>
                  </>
                ) : (
                  <span className="text-amber-400">Acquiring GPS fix...</span>
                )}
              </div>
              <p className="text-slate-300 text-xs mt-1">
                {userLocation?.address || (gpsError ? gpsError : 'Locating your exact street address...')}
              </p>
            </div>
          </div>

          <button
            onClick={locateCitizen}
            disabled={locating}
            className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-xs font-semibold text-sky-300 border border-sky-500/30 transition-all flex items-center gap-1.5 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
            <span>{locating ? 'Refreshing...' : 'Refresh GPS'}</span>
          </button>
        </div>
      </div>

      {/* Primary Emergency Section: Big SOS Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 1-Click SOS Hub */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-rose-900/50 bg-gradient-to-b from-slate-900/90 to-rose-950/20 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
                Emergency SOS Dispatch
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Press the SOS button or fill out details to summon immediate dispatch
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              PRIORITY-1
            </span>
          </div>

          {/* Big Circular SOS Button */}
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <button
              onClick={triggerSosButton}
              disabled={submitting}
              className={`relative w-40 h-40 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center font-black transition-all transform active:scale-95 shadow-2xl ${
                sosActive
                  ? 'bg-amber-600 text-white animate-bounce'
                  : 'bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 hover:from-rose-600 hover:to-red-400 text-white shadow-rose-900/70 hover:shadow-rose-600/50'
              }`}
              style={{
                boxShadow: sosActive
                  ? '0 0 50px rgba(245, 158, 11, 0.8)'
                  : '0 0 40px rgba(225, 29, 72, 0.6)',
              }}
            >
              <div className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping opacity-40"></div>
              {sosActive ? (
                <>
                  <span className="text-4xl font-mono font-black">{sosCountdown}</span>
                  <span className="text-xs uppercase tracking-widest mt-1">Tap to Cancel</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-12 h-12 mb-1" />
                  <span className="text-2xl tracking-tight">SOS HELP</span>
                  <span className="text-[10px] font-mono tracking-widest uppercase opacity-90">1-Tap Dispatch</span>
                </>
              )}
            </button>
            <p className="text-xs text-slate-400 text-center max-w-xs">
              {sosActive
                ? `Dispatching in ${sosCountdown} seconds! Tap again to cancel.`
                : 'Locks your coordinates and transmits high-priority emergency alarm to dispatchers.'}
            </p>
          </div>

          {/* Emergency Category Selector */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              1. Select Emergency Department Needed
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'Medical', label: 'Ambulance', sub: 'Medical emergency', icon: Ambulance, color: 'text-sky-400', border: 'hover:border-sky-500' },
                { id: 'Traffic', label: 'Traffic Crash', sub: 'Vehicle collision', icon: AlertTriangle, color: 'text-amber-400', border: 'hover:border-amber-500' },
                { id: 'Fire', label: 'Fire & Rescue', sub: 'Fire / Explosion', icon: Flame, color: 'text-rose-500', border: 'hover:border-rose-500' },
                { id: 'Police', label: 'Police Force', sub: 'Crime / Safety', icon: Shield, color: 'text-indigo-400', border: 'hover:border-indigo-500' },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = emergencyType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEmergencyType(item.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-rose-500/20 border-rose-500 shadow-md shadow-rose-950 text-white'
                        : `bg-slate-950/60 border-slate-800 text-slate-300 ${item.border}`
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${item.color} mb-1.5`} />
                    <p className="text-xs font-bold">{item.label}</p>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{item.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Additional details & Camera photo upload */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              2. Situation Details & Camera Upload (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the incident (e.g. 2 injured, car flipped over, nearest landmark...)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />

            {/* Photo upload */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-xs font-bold text-slate-950 cursor-pointer shadow-md transition-all active:scale-95 font-mono">
                <Camera className="w-4 h-4 text-slate-950" />
                <span>{selectedFile ? 'Retake Photo' : '📸 Take Photo (Camera)'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer transition-colors font-mono">
                <span>Upload File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {aiAnalyzing && (
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>AI Scanning photo for accident detection...</span>
                </div>
              )}

              {aiResult && (
                <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  AI Verified: {aiResult.severity} severity ({aiResult.confidence_score}% confidence)
                </span>
              )}
            </div>

            {previewUrl && (
              <div className="w-32 h-20 rounded-xl overflow-hidden border border-slate-700 relative">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Dispatch Submit Bar */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Position: <strong className="text-slate-200">{userLocation?.address ? 'GPS Locked' : 'Locating...'}</strong>
            </span>

            <button
              onClick={submitEmergencySos}
              disabled={submitting || !userLocation}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-rose-900/40 transition-all disabled:opacity-50 active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Dispatching...' : 'Confirm & Request Emergency Response'}</span>
            </button>
          </div>
        </div>

        {/* Right 1 Col: Quick Dial Emergency Numbers & Closest Units */}
        <div className="space-y-6">
          {/* Emergency Hotlines */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-rose-500" />
              Direct Emergency Speed Dial
            </h3>

            <div className="space-y-2.5">
              {[
                { number: '108', title: 'Ambulance & Medical Emergency', bg: 'hover:border-sky-500', color: 'text-sky-400' },
                { number: '112', title: 'National Emergency Response (All-in-One)', bg: 'hover:border-rose-500', color: 'text-rose-400' },
                { number: '101', title: 'Fire & Rescue Services', bg: 'hover:border-amber-500', color: 'text-amber-400' },
                { number: '100', title: 'Police Control Room', bg: 'hover:border-indigo-500', color: 'text-indigo-400' },
                { number: '1073', title: 'Highway Emergency & Traffic Help', bg: 'hover:border-emerald-500', color: 'text-emerald-400' },
              ].map((line) => (
                <a
                  key={line.number}
                  href={`tel:${line.number}`}
                  className={`flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 ${line.bg} transition-all group`}
                >
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-rose-300">{line.title}</p>
                    <span className="text-[11px] font-mono text-slate-400">Toll Free 24/7</span>
                  </div>
                  <span className={`text-base font-black font-mono ${line.color} px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800`}>
                    {line.number}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Closest Active Emergency Units */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
                <Ambulance className="w-4 h-4 text-sky-400" />
                Nearby Emergency Units
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">From your GPS</span>
            </div>

            <div className="space-y-2">
              {sortedUnits.slice(0, 4).map((u) => (
                <div
                  key={u.id}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <span className="font-bold text-white">{u.unit_id}</span>
                    <span className="text-slate-400 text-[11px] block">{u.type} &bull; {u.driver_name}</span>
                  </div>
                  <div className="text-right">
                    {u.dist !== null ? (
                      <span className="text-emerald-400 font-bold block">{u.dist} km</span>
                    ) : (
                      <span className="text-slate-500 block">--</span>
                    )}
                    <span className="text-[10px] text-sky-400 font-semibold">{u.status}</span>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/map"
              className="w-full mt-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Track Units on Live Map</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Confirmation Modal if SOS sent */}
      {sosSent && (
        <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Emergency Request Transmitted Successfully</h4>
              <p className="text-xs text-slate-300">
                Incident Reference: <strong className="text-emerald-300 font-mono">{sosSent.incident_id}</strong> &bull; Status: {sosSent.response_status}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/incidents/${sosSent.id}`}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono transition-colors"
            >
              Track Dispatch Status &rarr;
            </Link>
            <button
              onClick={() => setSosSent(null)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Citizen's Recent Incident History */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-400" />
          Recent Emergency Incidents in Network
        </h3>

        <div className="space-y-2">
          {recentIncidents.slice(0, 5).map((inc) => (
            <div
              key={inc.id}
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-rose-400">{inc.incident_id}</span>
                <span className="text-slate-300">{inc.address}</span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                  {inc.response_status}
                </span>
                <span className="text-slate-400">{formatDateTime(inc.date_time)}</span>
                <Link
                  to={`/incidents/${inc.id}`}
                  className="text-sky-400 hover:text-sky-300 font-bold"
                >
                  Details &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
