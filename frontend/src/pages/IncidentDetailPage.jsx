import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  XCircle,
  Ambulance,
  MapPin,
  Clock,
  User,
  Cpu,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Send,
  Radio,
  Camera,
  PhoneCall
} from 'lucide-react';
import { accidentsApi, unitsApi, assignmentsApi } from '../services/api';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateUtils';
import { cleanLocation, cleanPhoneNumber } from '../services/mockData';

export const IncidentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOperator } = useAuth();

  const [incident, setIncident] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Unit assignment state
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Status progression state
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchIncidentData = async () => {
    try {
      const [incRes, unitRes] = await Promise.all([
        accidentsApi.getAccident(id),
        unitsApi.getUnits({ status: 'Available' }),
      ]);
      setIncident(incRes.data.accident);
      setUnits(unitRes.data.units || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch incident details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidentData();
  }, [id]);

  const handleVerify = async (status) => {
    try {
      const res = await accidentsApi.verifyAccident(id, { verification_status: status });
      setIncident(res.data.accident);
      setActionSuccess(`Incident marked as ${status}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Verification action failed');
    }
  };

  const handleAssignUnit = async (e) => {
    e.preventDefault();
    if (!selectedUnitId) return;
    setAssigning(true);
    try {
      await assignmentsApi.createAssignment({
        incident_id: incident.id,
        unit_id: parseInt(selectedUnitId),
        notes: assignmentNotes,
      });
      setActionSuccess('Emergency unit assigned successfully.');
      setSelectedUnitId('');
      setAssignmentNotes('');
      fetchIncidentData();
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Failed to assign unit.');
    } finally {
      setAssigning(false);
    }
  };

  const handleProgressStatus = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      const res = await accidentsApi.updateStatus(id, { response_status: newStatus });
      setIncident(res.data.accident);
      setActionSuccess(`Response lifecycle transitioned to ${newStatus}`);
      fetchIncidentData();
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Status update failed.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="p-8 text-center glass-panel rounded-2xl border border-rose-500/30 max-w-lg mx-auto">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <p className="text-sm text-white font-bold mb-4">{error || 'Incident not found'}</p>
        <Link to="/incidents" className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-white">
          Return to Incidents List
        </Link>
      </div>
    );
  }

  const isVerified = incident.verification_status === 'Verified';

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/incidents')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white font-mono">
                {incident.incident_id}
              </h1>
              <SeverityBadge severity={incident.severity} size="lg" />
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Reported: {formatDateTime(incident.date_time)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={incident.verification_status} type="verification" />
          <StatusBadge status={incident.response_status} type="response" />
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-emerald-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Left Column Details & AI Media, Right Column Workflow & Dispatch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Details & Media */}
        <div className="lg:col-span-7 space-y-6">
          {/* Metadata Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider border-b border-slate-800 pb-2">
              Incident Dossier
            </h2>

            {(() => {
              const cleanAddr = cleanLocation(incident.address);
              const userPhone = cleanPhoneNumber(
                incident.phone_number ||
                incident.phone ||
                (typeof incident.reporter === 'string' && incident.reporter.match(/\+?\d[\d\-\s]{6,}/)?.[0] ? incident.reporter : '')
              );

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <p className="text-slate-400 uppercase text-[10px]">Location Address</p>
                    <p className="text-slate-200 font-sans font-medium mt-0.5 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{cleanAddr}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-400 uppercase text-[10px]">Citizen Contact</p>
                    {userPhone ? (
                      <div className="mt-1 flex items-center gap-2">
                        <a
                          href={`tel:${userPhone}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/30 text-xs font-bold"
                        >
                          <PhoneCall className="w-3 h-3 text-blue-400" />
                          <span>{userPhone}</span>
                        </a>
                      </div>
                    ) : (
                      <p className="text-slate-400 mt-1 italic text-[11px]">Not Provided</p>
                    )}
                  </div>

                  <div>
                    <p className="text-slate-400 uppercase text-[10px]">GPS Coordinates</p>
                    <p className="text-slate-200 mt-0.5">
                      {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-400 uppercase text-[10px]">Reporter / Source</p>
                    <p className="text-slate-200 mt-0.5 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{incident.reporter && !incident.reporter.includes('TEST0') ? incident.reporter : 'Direct SOS Channel'}</span>
                    </p>
                  </div>
                </div>
              );
            })()}

            <div>
              <p className="text-slate-400 uppercase text-[10px] font-mono">Incident Summary Notes</p>
              <p className="text-xs text-slate-300 mt-1 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80">
                {incident.description || 'No additional notes provided.'}
              </p>
            </div>

            {incident.verified_by_name && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Verified By Operator:</span>
                <span className="text-emerald-400 font-semibold">{incident.verified_by_name}</span>
              </div>
            )}
          </div>

          {/* AI Vision Media Preview */}
          {incident.detection && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                Linked AI Computer Vision Detection
              </h3>

              <div className="rounded-xl overflow-hidden bg-black max-h-96 flex items-center justify-center">
                {incident.detection.result_media_path ? (
                  <img
                    src={`/${incident.detection.result_media_path}`}
                    alt="AI Annotated Detection"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                ) : (
                  <img
                    src={`/${incident.detection.media_path}`}
                    alt="Original Uploaded Media"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                )}
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2">
                <span>Model: {incident.detection.model_version}</span>
                <span>Inference Time: {incident.detection.inference_time_ms}ms</span>
              </div>
            </div>
          )}

          {/* Citizen Live Camera Proof */}
          {incident.photo && (
            <div className="glass-panel p-6 rounded-2xl border-2 border-emerald-500/40 space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-emerald-300 uppercase font-mono tracking-wider flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  Citizen Live Camera Proof
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  VERIFIED SCENE PHOTO
                </span>
              </div>

              <div className="rounded-xl overflow-hidden bg-black max-h-96 flex items-center justify-center border border-slate-700">
                <img
                  src={incident.photo}
                  alt="Citizen Live Photo Evidence"
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>

              <p className="text-[11px] font-mono text-slate-400">
                Live camera snapshot captured by citizen during emergency broadcast.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Operator Verification & Emergency Response Dispatch */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1: Human Verification Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              1. Human Operator Verification
            </h2>

            <p className="text-xs text-slate-400">
              Protocol requirement: A human operator must visually verify the scene before allocating emergency units.
            </p>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Current Status:</span>
              <StatusBadge status={incident.verification_status} type="verification" />
            </div>

            {isOperator && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => handleVerify('Verified')}
                  disabled={incident.verification_status === 'Verified'}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Incident</span>
                </button>

                <button
                  onClick={() => handleVerify('Rejected')}
                  disabled={incident.verification_status === 'Rejected'}
                  className="py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 disabled:opacity-40 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Incident</span>
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Emergency Response Unit Allocation */}
          <div className={`glass-panel p-6 rounded-2xl border ${isVerified ? 'border-slate-800' : 'border-slate-800/40 opacity-70'} space-y-4`}>
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <Ambulance className="w-4 h-4 text-sky-400" />
              2. Emergency Unit Allocation
            </h2>

            {!isVerified ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                Unit assignment is disabled until the incident is verified by an operator.
              </div>
            ) : incident.assigned_unit ? (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Assigned Unit:</span>
                  <span className="font-bold text-rose-400">{incident.assigned_unit.unit_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Unit Type:</span>
                  <span className="text-slate-200">{incident.assigned_unit.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Officer / Driver:</span>
                  <span className="text-slate-200">{incident.assigned_unit.driver_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Contact Radio:</span>
                  <span className="text-slate-200">{incident.assigned_unit.contact_number}</span>
                </div>
              </div>
            ) : isOperator ? (
              <form onSubmit={handleAssignUnit} className="space-y-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Select Available Emergency Unit
                  </label>
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  >
                    <option value="">-- Choose Unit --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_id} - {u.type} ({u.driver_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Dispatch Instructions / Notes
                  </label>
                  <input
                    type="text"
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                    placeholder="e.g. Priority response, bring extrication gear"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={assigning || !selectedUnitId}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-sky-950/40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Assign & Alert Unit</span>
                </button>
              </form>
            ) : (
              <p className="text-xs text-slate-500 font-mono">No emergency unit assigned yet.</p>
            )}
          </div>

          {/* Step 3: Response Lifecycle Progression */}
          {isVerified && incident.assigned_unit && isOperator && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                <Navigation className="w-4 h-4 text-indigo-400" />
                3. Response Lifecycle Progression
              </h2>

              <p className="text-xs text-slate-400">
                Advance the operational status of this emergency as updates arrive from the field:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {['Dispatched', 'En Route', 'On Scene', 'Resolved'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleProgressStatus(st)}
                    disabled={updatingStatus || incident.response_status === st}
                    className={`py-2 px-3 rounded-xl text-xs font-bold font-mono transition-all ${
                      incident.response_status === st
                        ? 'bg-indigo-600 text-white shadow-lg'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timeline & Dispatch History */}
          {Array.isArray(incident.timeline) && incident.timeline.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Dispatch Timeline
              </h3>
              <div className="space-y-3 border-l-2 border-slate-800 pl-4 ml-2 text-xs font-mono">
                {incident.timeline.map((item, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <p className="font-bold text-slate-200">
                      {item.unit ? `${item.unit.unit_id} (${item.unit.type})` : 'Unit'}: {item.status}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Assigned: {formatDateTime(item.assigned_at)}
                    </p>
                    {item.notes && <p className="text-[11px] text-slate-400 font-sans mt-0.5">{item.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
