import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Navigation
} from 'lucide-react';
import { subscribeToEmergencyAlerts } from '../services/realtimeEmergency';
import { startEmergencySiren, stopEmergencySiren } from '../utils/sirenSound';
import { accidentsApi } from '../services/api';

export const EmergencyAlertModal = () => {
  const navigate = useNavigate();
  const [activeAlert, setActiveAlert] = useState(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Request desktop notification permission if not yet prompted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // Subscribe to incoming remote mobile SOS alerts
    const unsubscribe = subscribeToEmergencyAlerts((incomingAlert) => {
      console.log('🚨 REAL-TIME SOS RECEIVED ON OPERATOR TERMINAL:', incomingAlert);

      setActiveAlert(incomingAlert);

      // Play emergency siren
      startEmergencySiren();

      // Desktop browser notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`🚨 CITIZEN SOS: ${incomingAlert.type || 'Emergency'}`, {
          body: `${incomingAlert.address || 'Live Location'}\nContact: ${incomingAlert.reporter_phone || incomingAlert.phone || 'Citizen'}`,
          icon: '/favicon.ico',
        });
      }

      // Automatically register into backend/mock DB so it appears on the Live Map
      try {
        if (incomingAlert.latitude && incomingAlert.longitude) {
          accidentsApi.createAccident({
            latitude: incomingAlert.latitude,
            longitude: incomingAlert.longitude,
            address: incomingAlert.address || 'Live Citizen Location',
            description: `[CITIZEN SOS] ${incomingAlert.type || 'Emergency'} distress call. Phone: ${incomingAlert.reporter_phone || incomingAlert.phone || 'Citizen'}. ${incomingAlert.notes || ''}`,
            severity: 'Critical',
            reporter: incomingAlert.reporter_phone || incomingAlert.phone || 'Citizen Mobile SOS',
            ai_confidence: 99.0,
            verification_status: 'Verified',
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('Auto-register error:', e);
      }
    });

    return () => {
      unsubscribe();
      stopEmergencySiren();
    };
  }, []);

  const handleDismiss = () => {
    stopEmergencySiren();
    setActiveAlert(null);
    setIsMuted(false);
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
    setActiveAlert(null);
    navigate('/map');
  };

  if (!activeAlert) return null;

  const typeIcons = {
    Medical: Ambulance,
    Police: Shield,
    Fire: Flame,
    Traffic: AlertTriangle,
  };
  const AlertIcon = typeIcons[activeAlert.type] || AlertTriangle;

  const callerPhone = activeAlert.reporter_phone || activeAlert.phone || null;
  const hasValidPhone = callerPhone && callerPhone !== 'Citizen Mobile Caller' && callerPhone !== 'Citizen SOS';

  const exactLat = activeAlert.latitude ? Number(activeAlert.latitude).toFixed(5) : null;
  const exactLng = activeAlert.longitude ? Number(activeAlert.longitude).toFixed(5) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* Outer pulsing glow */}
      <div className="absolute inset-0 pointer-events-none bg-rose-600/20 animate-pulse" />

      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border-2 border-rose-500 shadow-2xl shadow-rose-950/90 overflow-hidden text-white animate-scaleUp">
        {/* Header: Clean & Urgent */}
        <div className="bg-gradient-to-r from-rose-600 to-red-600 px-5 py-3.5 flex items-center justify-between">
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

        {/* 4 Essential Fields: Distress Type, Number, Location, Exact GPS */}
        <div className="p-5 space-y-3">
          {/* 1. DISTRESS TYPE */}
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
                  {activeAlert.type || 'Medical'} Emergency
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-[11px] font-mono font-bold uppercase border border-rose-500/40 animate-pulse">
              CRITICAL
            </span>
          </div>

          {/* 2. CITIZEN PHONE NUMBER */}
          <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                <PhoneCall className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  PHONE NUMBER
                </span>
                <span className="text-sm font-mono font-bold text-white">
                  {callerPhone || 'Not provided by caller'}
                </span>
              </div>
            </div>

            {hasValidPhone && (
              <a
                href={`tel:${callerPhone}`}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono flex items-center gap-1 shadow-md transition-colors"
              >
                <span>Call</span>
              </a>
            )}
          </div>

          {/* 3. LOCATION (STREET ADDRESS) */}
          <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                LOCATION / ADDRESS
              </span>
              <p className="text-xs font-semibold text-slate-200 mt-0.5 leading-snug">
                {activeAlert.address || 'Live Citizen GPS Location'}
              </p>
              {activeAlert.notes && activeAlert.notes !== activeAlert.address && (
                <p className="text-[11px] text-amber-300/90 mt-1 font-mono italic">
                  Note: "{activeAlert.notes}"
                </p>
              )}
            </div>
          </div>

          {/* 4. EXACT GPS COORDINATES */}
          <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Navigation className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                EXACT GPS COORDINATES
              </span>
              <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                {exactLat && exactLng ? `${exactLat}, ${exactLng}` : 'Acquired via Satellite GPS'}
              </p>
            </div>
          </div>

          {/* Action Buttons: Open on Map & Dismiss */}
          <div className="pt-2 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleViewOnLiveMap}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-950/60 flex items-center justify-center gap-2 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open on Live Map</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Dismiss Siren</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
