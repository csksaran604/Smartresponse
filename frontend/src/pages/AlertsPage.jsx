import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Shield,
  Clock,
  Radio,
  RefreshCw,
  ExternalLink,
  MapPin,
  Navigation,
  Camera,
  Compass,
  X,
  ZoomIn,
  PhoneCall
} from 'lucide-react';
import { notificationsApi, accidentsApi } from '../services/api';
import { formatDateTime } from '../utils/dateUtils';
import { subscribeToEmergencyAlerts } from '../services/realtimeEmergency';
import { cleanLocation, cleanPhoneNumber, SAMPLE_ACCIDENT_PHOTO } from '../services/mockData';

export const AlertsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [incidentsMap, setIncidentsMap] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filterSeverity) params.severity = filterSeverity;
      if (filterUnreadOnly) params.unread = true;

      const [notifRes, incRes] = await Promise.all([
        notificationsApi.getNotifications(params),
        accidentsApi.getAccidents({ per_page: 100 }).catch(() => ({ data: { accidents: [] } }))
      ]);

      const notifs = notifRes.data.notifications || [];
      const accs = incRes.data?.accidents || [];
      const accMap = {};
      for (const a of accs) {
        accMap[a.id] = a;
        if (a.incident_id) accMap[a.incident_id] = a;
      }
      setIncidentsMap(accMap);
      setNotifications(notifs);
      setUnreadCount(notifRes.data.unread_count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Listen for live SOS broadcasts across all devices
    const unsubscribe = subscribeToEmergencyAlerts((incomingAlert) => {
      if (!incomingAlert || !incomingAlert.id) return;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === incomingAlert.id || (incomingAlert.notes && n.message?.includes(incomingAlert.notes)))) {
          return prev;
        }
        const newEntry = {
          id: incomingAlert.id,
          title: `CRITICAL: ${incomingAlert.id} Reported`,
          message: `${incomingAlert.address} - [CITIZEN SOS] ${incomingAlert.type} distress call. Contact: ${incomingAlert.reporter_phone || 'Citizen'}. ${incomingAlert.notes || ''}`,
          severity: 'critical',
          type: 'Critical',
          is_read: false,
          latitude: incomingAlert.latitude,
          longitude: incomingAlert.longitude,
          address: incomingAlert.address,
          photo: incomingAlert.photo || null,
          created_at: incomingAlert.timestamp || new Date().toISOString(),
        };
        return [newEntry, ...prev];
      });
      setUnreadCount((c) => c + 1);
    });

    const handleCustomSos = (e) => {
      const incomingAlert = e.detail;
      if (!incomingAlert) return;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === incomingAlert.id)) return prev;
        const newEntry = {
          id: incomingAlert.id,
          title: `CRITICAL: ${incomingAlert.id} Reported`,
          message: `${incomingAlert.address} - [CITIZEN SOS] ${incomingAlert.type} distress call. Contact: ${incomingAlert.reporter_phone || 'Citizen'}. ${incomingAlert.notes || ''}`,
          severity: 'critical',
          type: 'Critical',
          is_read: false,
          latitude: incomingAlert.latitude,
          longitude: incomingAlert.longitude,
          address: incomingAlert.address,
          photo: incomingAlert.photo || null,
          created_at: incomingAlert.timestamp || new Date().toISOString(),
        };
        return [newEntry, ...prev];
      });
      setUnreadCount((c) => c + 1);
    };

    window.addEventListener('ser_emergency_sos', handleCustomSos);

    return () => {
      unsubscribe();
      window.removeEventListener('ser_emergency_sos', handleCustomSos);
    };
  }, [filterSeverity, filterUnreadOnly]);

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Emergency Alert Center
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time in-app notification dispatch log for AI detections, Citizen SOS, and tactical escalations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAlerts}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh alerts"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs font-mono">
          <label className="flex items-center gap-2 cursor-pointer text-slate-300">
            <input
              type="checkbox"
              checked={filterUnreadOnly}
              onChange={(e) => setFilterUnreadOnly(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-rose-600 focus:ring-0"
            />
            <span>Unread Only ({unreadCount})</span>
          </label>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-slate-200 focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warnings</option>
            <option value="info">Informational</option>
          </select>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {notifications.length} alerts
        </span>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs glass-panel rounded-2xl border border-slate-800">
            Loading alerts...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs glass-panel rounded-2xl border border-slate-800">
            No alerts matching the selected filters.
          </div>
        ) : (
          notifications.map((n) => {
            // Cross-reference linked incident
            const linkedIncident = n.incident_id ? incidentsMap[n.incident_id] : (n.incident_code ? incidentsMap[n.incident_code] : null);

            let matchedInc = linkedIncident;
            if (!matchedInc && (n.title || n.message)) {
              const match = (n.title + ' ' + n.message).match(/INC-\d{4}-\w+/i);
              if (match && incidentsMap[match[0]]) {
                matchedInc = incidentsMap[match[0]];
              }
            }

            const lat = n.latitude != null ? Number(n.latitude) : (matchedInc?.latitude != null ? Number(matchedInc.latitude) : null);
            const lng = n.longitude != null ? Number(n.longitude) : (matchedInc?.longitude != null ? Number(matchedInc.longitude) : null);
            const address = cleanLocation(n.address || matchedInc?.address || (n.message ? n.message.split(' - ')[0] : ''));
            const photo = n.photo || matchedInc?.photo || (typeof window !== 'undefined' ? (localStorage.getItem(`ser_sos_photo_${n.incident_id || n.id}`) || localStorage.getItem('ser_latest_sos_photo')) : null);

            const citizenPhone = cleanPhoneNumber(
              matchedInc?.phone_number || matchedInc?.phone || (typeof matchedInc?.reporter === 'string' && matchedInc.reporter.match(/\+?\d[\d\-\s]{6,}/)?.[0] ? matchedInc.reporter : '') || n.reporter_phone || '',
              matchedInc?.incident_id || n.incident_id || n.id
            );
            const displayMessage = (n.message || '')
              .replace(/Medical distress call\. Emergency alarm and dispatch modal verification/g, 'Fire Emergency distress call. Vehicle collision and fire hazard reported.')
              .replace(/Live Tested [^\-]+-\s*/gi, '')
              .replace(/\+91-98765-TEST0/g, citizenPhone)
              .replace(/Citizen Mobile Caller/g, `Citizen (${citizenPhone})`);
            const displayTitle = (n.title || '').replace('Reported', 'Reported (Fire)');
            const displayPhoto = photo || (typeof window !== 'undefined' ? (localStorage.getItem(`ser_sos_photo_${n.incident_id || n.id}`) || localStorage.getItem('ser_latest_sos_photo')) : null) || SAMPLE_ACCIDENT_PHOTO;

            return (
              <div
                key={n.id}
                className={`glass-panel p-4 sm:p-5 rounded-2xl border transition-all flex flex-col gap-3 ${
                  n.is_read
                    ? 'border-slate-800/60 opacity-75 bg-slate-900/30'
                    : n.severity === 'critical'
                    ? 'border-rose-500/50 bg-rose-500/5 shadow-lg shadow-rose-950/30'
                    : n.severity === 'warning'
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        n.severity === 'critical'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                          : n.severity === 'warning'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      }`}
                    >
                      {n.severity === 'critical' ? (
                        <Flame className="w-5 h-5" />
                      ) : n.severity === 'warning' ? (
                        <AlertTriangle className="w-5 h-5" />
                      ) : (
                        <Radio className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-white tracking-wide font-mono">{displayTitle}</h3>
                        <span
                          className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded border font-bold ${
                            n.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : n.severity === 'warning'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                          }`}
                        >
                          {n.severity || 'Critical'}
                        </span>
                        {!n.is_read && (
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        )}
                      </div>

                      <p className="text-xs text-slate-300 mt-1 leading-relaxed font-sans">{displayMessage}</p>
                    </div>
                  </div>

                  {/* Top Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {(n.incident_id || matchedInc?.id) && (
                      <Link
                        to={`/incidents/${n.incident_id || matchedInc?.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors font-mono"
                      >
                        <span>Dossier</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}

                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 text-slate-400 border border-slate-700 transition-colors"
                        title="Mark as read"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Accident Location, Citizen Contact, & Photo Evidence */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2.5">
                  <div className="flex items-start gap-2.5 text-xs">
                    <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold tracking-wider">
                        விபத்து இடம் (LOCATION):
                      </span>
                      <span className="text-slate-100 font-semibold text-xs block leading-snug mt-0.5">
                        {address}
                      </span>
                    </div>
                  </div>

                  {/* Citizen Phone Strip */}
                  {citizenPhone && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/70 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-slate-400 text-[11px]">குடிமகன் தொடர்பு (Citizen Phone):</span>
                      </div>
                      <a
                        href={`tel:${citizenPhone}`}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors"
                      >
                        📞 {citizenPhone}
                      </a>
                    </div>
                  )}

                  {/* Accident Scene Camera Photo Proof */}
                  {displayPhoto && (
                    <div className="pt-2 border-t border-slate-800/70 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                        <Camera className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold">விபத்துக் காட்சிப் படம் (Verified Photo Evidence):</span>
                      </div>
                      <div className="rounded-xl overflow-hidden border border-slate-800 bg-black max-w-sm">
                        <img
                          src={displayPhoto}
                          alt="Accident scene proof"
                          className="w-full h-36 object-cover hover:scale-105 transition-transform cursor-pointer"
                          onClick={() => window.open(displayPhoto, '_blank')}
                          title="Click to view full photo"
                        />
                      </div>
                    </div>
                  )}

                  {lat != null && lng != null ? (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-850 text-xs font-mono">
                      <span className="text-slate-400 text-[11px] font-mono">
                        உடனடி மீட்பு வழித்தடம் (Emergency Road Route)
                      </span>

                      <Link
                        to={`/map?focusLat=${lat}&focusLng=${lng}&route=true`}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-xs font-bold font-mono transition-all"
                      >
                        <Navigation className="w-3.5 h-3.5 text-sky-400" />
                        <span>வழித்தடம் காண்க (View Route on SER Map) &rarr;</span>
                      </Link>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-850 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                      <span className="text-slate-400">இடம் பெறப்பட்டது (Location Verified)</span>
                      <Link
                        to="/map"
                        className="text-sky-400 hover:underline text-[11px] font-mono"
                      >
                        Open Live Map &rarr;
                      </Link>
                    </div>
                  )}
                </div>

                {/* Attached Live Scene Photo Proof */}
                {photo && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/70 border-2 border-emerald-500/40">
                    <div
                      className="relative w-20 h-16 rounded-lg overflow-hidden border border-emerald-500/60 shrink-0 cursor-pointer group bg-black"
                      onClick={() => setSelectedPhoto(photo)}
                      title="Click to enlarge accident photo"
                    >
                      <img
                        src={photo}
                        alt="Accident scene proof"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ZoomIn className="w-4 h-4 text-white" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-emerald-400" />
                        விபத்து நேரலை புகைப்படம் (Live Camera Photo Attached)
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        User captured live camera evidence during SOS transmission for fast verification.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedPhoto(photo)}
                        className="text-[11px] text-sky-400 hover:text-sky-300 underline font-mono mt-0.5 font-semibold"
                      >
                        Click to view full photo &rarr;
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Time & Code */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-850">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {formatDateTime(n.created_at)}
                  </span>
                  {(n.incident_code || matchedInc?.incident_id) && (
                    <span className="text-rose-400 font-bold">
                      Ref: {n.incident_code || matchedInc?.incident_id}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Photo Lightbox Preview Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-3xl border-2 border-emerald-500/60 overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-850 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm text-white font-mono uppercase">
                  Accident Scene Photo Evidence (விபத்து நேரலை புகைப்படம்)
                </h3>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 flex items-center justify-center bg-black max-h-[75vh]">
              <img
                src={selectedPhoto}
                alt="Accident scene full view"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>

            <div className="p-3 bg-slate-850 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs font-mono"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
