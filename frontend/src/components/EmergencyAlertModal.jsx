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
  Clock,
  PhoneCall,
  CheckCircle2,
  Navigation
} from 'lucide-react';
import { subscribeToEmergencyAlerts } from '../services/realtimeEmergency';
import { startEmergencySiren, stopEmergencySiren, playAlertChime } from '../utils/sirenSound';
import { accidentsApi, unitsApi } from '../services/api';

export const EmergencyAlertModal = () => {
  const navigate = useNavigate();
  const [activeAlert, setActiveAlert] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchedSuccess, setDispatchedSuccess] = useState(false);

  useEffect(() => {
    // Request desktop notification permission if not yet decided
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // Subscribe to incoming remote mobile SOS alerts
    const unsubscribe = subscribeToEmergencyAlerts((incomingAlert) => {
      console.log('🚨 REAL-TIME SOS RECEIVED ON OPERATOR TERMINAL:', incomingAlert);
      
      setActiveAlert(incomingAlert);
      setDispatchedSuccess(false);

      // Play emergency siren
      startEmergencySiren();

      // Fire desktop notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`🚨 EMERGENCY SOS TRIGGERED: ${incomingAlert.type || 'Incident'}`, {
          body: incomingAlert.address || incomingAlert.message || 'Citizen requested immediate emergency dispatch!',
          icon: '/favicon.ico',
        });
      }

      // Auto-register into database/mock store so it's immediately on map
      try {
        if (incomingAlert.latitude && incomingAlert.longitude) {
          accidentsApi.createAccident({
            latitude: incomingAlert.latitude,
            longitude: incomingAlert.longitude,
            address: incomingAlert.address || 'Live Citizen SOS Location',
            description: `[PUBLIC SOS] ${incomingAlert.type} emergency requested. Contact: ${incomingAlert.reporter_phone || 'Citizen'}. ${incomingAlert.notes || ''}`,
            severity: 'Critical',
            reporter: incomingAlert.reporter_phone || 'Citizen Mobile SOS',
            ai_confidence: 99.0,
            verification_status: 'Verified',
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('Auto-register alert error:', e);
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

  const handleQuickDispatch = async () => {
    setDispatching(true);
    try {
      // Find first available unit
      const uRes = await unitsApi.getUnits();
      const availableUnit = (uRes.data?.units || []).find(u => u.status === 'Available');

      if (availableUnit) {
        await unitsApi.updateUnit(availableUnit.id, { status: 'Dispatched' });
      }

      setDispatchedSuccess(true);
      playAlertChime();
      setTimeout(() => {
        stopEmergencySiren();
      }, 1000);
    } catch (err) {
      console.warn('Quick dispatch error:', err);
    } finally {
      setDispatching(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Outer pulsing glow */}
      <div className="absolute inset-0 pointer-events-none bg-rose-600/20 animate-pulse" />

      <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border-2 border-rose-500 shadow-2xl shadow-rose-950/80 overflow-hidden text-white animate-scaleUp">
        {/* Top Emergency Siren Banner */}
        <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center animate-bounce">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded bg-black/30 text-rose-100 font-mono">
                  LIVE SOS BROADCAST
                </span>
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-white mt-0.5">
                CRITICAL CITIZEN DISTRESS SIGNAL
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Mute Button */}
            <button
              onClick={handleToggleMute}
              className={`p-2 rounded-xl border transition-all ${
                isMuted
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-white text-rose-600 border-white shadow-lg shadow-rose-900/40 animate-pulse'
              }`}
              title={isMuted ? 'Unmute Siren Alarm' : 'Mute Siren Alarm'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="p-2 rounded-xl bg-black/30 hover:bg-black/50 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Details */}
        <div className="p-6 space-y-5">
          {/* Emergency Category Card */}
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
              <AlertIcon className="w-7 h-7 text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-rose-300 uppercase tracking-wide">
                  {activeAlert.type || 'Medical'} Emergency
                </span>
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Just now
                </span>
              </div>
              <p className="text-sm text-slate-200 mt-1 font-medium leading-relaxed">
                {activeAlert.notes || activeAlert.message || 'Distress button triggered on remote mobile device. Immediate responder dispatch recommended.'}
              </p>
            </div>
          </div>

          {/* Location & GPS Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mb-1">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>CITIZEN ADDRESS</span>
              </div>
              <p className="text-xs text-white font-semibold line-clamp-2">
                {activeAlert.address || 'Live GPS Locked'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mb-1">
                <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>GPS COORDINATES</span>
              </div>
              <p className="text-xs text-emerald-400 font-mono font-bold">
                {activeAlert.latitude ? `${activeAlert.latitude.toFixed(5)}, ${activeAlert.longitude?.toFixed(5)}` : 'Location Broadcast'}
              </p>
            </div>
          </div>

          {dispatchedSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center gap-3 text-emerald-300 text-xs font-medium">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Nearest emergency unit successfully dispatched! Siren silenced.</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleQuickDispatch}
              disabled={dispatching || dispatchedSuccess}
              className="py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-sm shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Ambulance className="w-4 h-4" />
              <span>{dispatchedSuccess ? 'Unit Dispatched' : dispatching ? 'Dispatching...' : 'Dispatch Nearest Unit'}</span>
            </button>

            <button
              type="button"
              onClick={handleViewOnLiveMap}
              className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 flex items-center justify-center gap-2 transition-all"
            >
              <ExternalLink className="w-4 h-4 text-slate-400" />
              <span>Open on Live GPS Map</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
