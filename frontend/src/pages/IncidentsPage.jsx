import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  ShieldCheck,
  XCircle,
  Eye,
  RefreshCw,
  PhoneCall,
  MapPin
} from 'lucide-react';
import { accidentsApi } from '../services/api';
import { broadcastEmergencySos } from '../services/realtimeEmergency';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateUtils';
import { cleanLocation, cleanPhoneNumber } from '../services/mockData';

export const IncidentsPage = () => {
  const { isOperator } = useAuth();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [responseFilter, setResponseFilter] = useState('');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    address: '',
    latitude: 40.7128,
    longitude: -74.0060,
    severity: 'Medium',
    description: '',
  });
  const [createLoading, setCreateLoading] = useState(false);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (severityFilter) params.severity = severityFilter;
      if (verificationFilter) params.verification_status = verificationFilter;
      if (responseFilter) params.response_status = responseFilter;

      const res = await accidentsApi.getAccidents(params);
      setIncidents(res.data.accidents || []);
    } catch (err) {
      console.error('Failed to load accidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [severityFilter, verificationFilter, responseFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchIncidents();
  };

  const handleQuickVerify = async (id, status) => {
    try {
      await accidentsApi.verifyAccident(id, { verification_status: status });
      fetchIncidents();
    } catch (err) {
      alert(err.response?.data?.error || 'Verification failed');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await accidentsApi.createAccident(createForm);
      const created = res.data?.accident || createForm;
      await broadcastEmergencySos({
        id: created.id ? `SOS-${created.id}` : `SOS-${Date.now().toString().slice(-6)}`,
        type: 'Traffic',
        emergencyType: 'Traffic',
        latitude: createForm.latitude,
        longitude: createForm.longitude,
        address: createForm.address,
        notes: createForm.description || 'Manual incident report created',
        urgency: createForm.severity || 'Critical',
        source: 'INCIDENT_REGISTRATION',
      }).catch(() => {});

      setShowCreateModal(false);
      setCreateForm({
        address: '',
        latitude: 40.7128,
        longitude: -74.0060,
        severity: 'Medium',
        description: '',
      });
      fetchIncidents();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create incident');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Emergency Incident Management
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real database registry of reported, verified, and active emergency operations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchIncidents}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {isOperator && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-900/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Log Manual Incident</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search incident code, location address, description..."
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
          />
        </form>

        {/* Severity filter */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none font-mono w-full md:w-auto"
        >
          <option value="">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        {/* Verification filter */}
        <select
          value={verificationFilter}
          onChange={(e) => setVerificationFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none font-mono w-full md:w-auto"
        >
          <option value="">All Verification</option>
          <option value="Pending">Pending Verification</option>
          <option value="Verified">Verified</option>
          <option value="Rejected">Rejected</option>
        </select>

        {/* Response filter */}
        <select
          value={responseFilter}
          onChange={(e) => setResponseFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none font-mono w-full md:w-auto"
        >
          <option value="">All Response Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Unit Assigned">Unit Assigned</option>
          <option value="Dispatched">Dispatched</option>
          <option value="En Route">En Route</option>
          <option value="On Scene">On Scene</option>
          <option value="Resolved">Resolved</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Incidents Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 uppercase font-mono text-[10px] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Incident Code</th>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Location Address</th>
                <th className="py-3 px-4">Citizen Contact</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">AI Score</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Response Status</th>
                <th className="py-3 px-4">Assigned Unit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-500" />
                    Loading incidents from database...
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No matching incidents found.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => {
                  const userPhone = cleanPhoneNumber(
                    inc.phone_number ||
                    inc.phone ||
                    (typeof inc.reporter === 'string' && inc.reporter.match(/\+?\d[\d\-\s]{6,}/)?.[0] ? inc.reporter : ''),
                    inc.incident_id || inc.id
                  );
                  const cleanAddr = cleanLocation(inc.address);

                  return (
                    <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors font-sans">
                      <td className="py-3 px-4 font-mono font-bold text-rose-400 whitespace-nowrap">
                        {inc.incident_id}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-xs whitespace-nowrap">
                        {formatDateTime(inc.date_time)}
                      </td>
                      <td className="py-3 px-4 min-w-[200px] max-w-[280px] text-slate-200">
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span className="leading-snug text-xs font-medium text-slate-100">{cleanAddr}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {userPhone ? (
                          <a
                            href={`tel:${userPhone}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-mono font-bold transition-colors"
                            title="Click to call citizen"
                          >
                            <PhoneCall className="w-3 h-3 text-blue-400" />
                            <span>{userPhone}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-500 italic">
                            {inc.reporter && !inc.reporter.includes('TEST0') && !inc.reporter.includes('Caller') ? inc.reporter : 'Not Provided'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <SeverityBadge severity={inc.severity} />
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <span className="font-semibold text-slate-300">{inc.ai_confidence}%</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={inc.verification_status} type="verification" />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={inc.response_status} type="response" />
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                        {inc.assigned_unit ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                            {inc.assigned_unit.unit_id}
                          </span>
                        ) : (
                          <span className="text-slate-600">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isOperator && inc.verification_status === 'Pending' && (
                            <>
                              <button
                                onClick={() => handleQuickVerify(inc.id, 'Verified')}
                                className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-colors"
                                title="Verify Incident"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleQuickVerify(inc.id, 'Rejected')}
                                className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 transition-colors"
                                title="Reject Incident"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <Link
                            to={`/incidents/${inc.id}`}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Incident Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-700 max-w-lg w-full bg-slate-900 shadow-2xl">
            <h2 className="text-base font-bold text-white mb-1">Register Manual Incident</h2>
            <p className="text-xs text-slate-400 mb-4 font-mono">Create an incident ticket directly into database</p>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase font-mono mb-1">
                  Location Address
                </label>
                <input
                  type="text"
                  required
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="e.g. Lincoln Tunnel Approach, NY"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase font-mono mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={createForm.latitude}
                    onChange={(e) => setCreateForm({ ...createForm, latitude: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase font-mono mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={createForm.longitude}
                    onChange={(e) => setCreateForm({ ...createForm, longitude: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase font-mono mb-1">
                  Incident Severity
                </label>
                <select
                  value={createForm.severity}
                  onChange={(e) => setCreateForm({ ...createForm, severity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase font-mono mb-1">
                  Incident Description
                </label>
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Notes, observed damage, lane blockage, injured parties..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-900/30 transition-all disabled:opacity-50"
                >
                  {createLoading ? 'Logging...' : 'Save Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
