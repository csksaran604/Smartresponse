/**
 * Demo Mock Data Store & Fallback Engine
 * Provides full offline/standalone demo functionality when the Flask backend
 * is not running or when the frontend is deployed to static hosts like Vercel.
 */

const STORAGE_KEYS = {
  INCIDENTS: 'ser_demo_incidents',
  UNITS: 'ser_demo_units',
  NOTIFICATIONS: 'ser_demo_notifications',
  LOGS: 'ser_demo_logs',
};

const INITIAL_UNITS = [
  {
    id: 1,
    unit_id: 'AMB-101',
    vehicle_number: 'AMB-NY-4401',
    type: 'Ambulance',
    driver_name: 'DEMO Paramedic Sarah Jenkins',
    contact_number: '+1-555-0101',
    status: 'Available',
    latitude: 40.7306,
    longitude: -73.9352,
    created_at: new Date(Date.now() - 36000000).toISOString(),
  },
  {
    id: 2,
    unit_id: 'AMB-102',
    vehicle_number: 'AMB-NY-4402',
    type: 'Ambulance',
    driver_name: 'DEMO EMT David Chen',
    contact_number: '+1-555-0102',
    status: 'Dispatched',
    latitude: 40.7282,
    longitude: -73.9942,
    created_at: new Date(Date.now() - 36000000).toISOString(),
  },
  {
    id: 3,
    unit_id: 'POL-201',
    vehicle_number: 'POL-NY-3301',
    type: 'Police',
    driver_name: 'DEMO Sergeant Marcus Vance',
    contact_number: '+1-555-0201',
    status: 'Available',
    latitude: 40.7589,
    longitude: -73.9851,
    created_at: new Date(Date.now() - 36000000).toISOString(),
  },
  {
    id: 4,
    unit_id: 'POL-202',
    vehicle_number: 'POL-NY-3302',
    type: 'Police',
    driver_name: 'DEMO Officer Elena Rostova',
    contact_number: '+1-555-0202',
    status: 'En Route',
    latitude: 40.7484,
    longitude: -73.9857,
    created_at: new Date(Date.now() - 36000000).toISOString(),
  },
  {
    id: 5,
    unit_id: 'FIR-301',
    vehicle_number: 'FIR-NY-9901',
    type: 'Fire & Rescue',
    driver_name: 'DEMO Captain Robert Hall',
    contact_number: '+1-555-0301',
    status: 'Available',
    latitude: 40.7112,
    longitude: -74.0123,
    created_at: new Date(Date.now() - 36000000).toISOString(),
  }
];

const INITIAL_INCIDENTS = [
  {
    id: 1,
    incident_id: 'INC-2026-001',
    date_time: new Date(Date.now() - 25 * 60000).toISOString(),
    created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    latitude: 40.7282,
    longitude: -73.9942,
    address: 'Broadway & 8th St Intersection, NY',
    description: 'Multi-vehicle impact detected at high-traffic crossing. Human operator verified vehicle damage.',
    severity: 'High',
    ai_confidence: 89.5,
    verification_status: 'Verified',
    response_status: 'Dispatched',
    assigned_unit_id: 2,
    assigned_unit: INITIAL_UNITS[1],
    reporter: 'CCTV Feed #12A',
    verified_by_id: 2,
    verified_by: { username: 'operator' },
    verified_at: new Date(Date.now() - 20 * 60000).toISOString(),
  },
  {
    id: 2,
    incident_id: 'INC-2026-002',
    date_time: new Date(Date.now() - 12 * 60000).toISOString(),
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    latitude: 40.7484,
    longitude: -73.9857,
    address: 'Midtown Expressway Mile Marker 4, NY',
    description: 'Overturned vehicle on highway lane 2. Severe obstruction with potential medical distress.',
    severity: 'Critical',
    ai_confidence: 94.2,
    verification_status: 'Verified',
    response_status: 'En Route',
    assigned_unit_id: 4,
    assigned_unit: INITIAL_UNITS[3],
    reporter: 'Traffic Bot Camera #44',
    verified_by_id: 2,
    verified_by: { username: 'operator' },
    verified_at: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 3,
    incident_id: 'INC-2026-003',
    date_time: new Date(Date.now() - 4 * 60000).toISOString(),
    created_at: new Date(Date.now() - 4 * 60000).toISOString(),
    latitude: 40.7180,
    longitude: -73.9990,
    address: 'Canal St & Bowery, NY',
    description: 'Minor rear-end bumper impact. No flames or structural collapse detected.',
    severity: 'Medium',
    ai_confidence: 72.0,
    verification_status: 'Pending',
    response_status: 'Pending',
    assigned_unit_id: null,
    reporter: 'Municipal Camera #9',
  }
];

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    title: 'CRITICAL: Severe Rollover Incident Verified',
    message: 'INC-2026-002 on Midtown Expressway verified by operator. Unit POL-202 en route.',
    type: 'Critical',
    is_read: false,
    created_at: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 2,
    title: 'New AI Incident Detection Ticket',
    message: 'High confidence collision detected at Canal St & Bowery. Awaiting human verification.',
    type: 'Warning',
    is_read: false,
    created_at: new Date(Date.now() - 4 * 60000).toISOString(),
  }
];

const INITIAL_LOGS = [
  {
    id: 1,
    username: 'admin',
    action: 'SYSTEM_BOOT',
    entity: 'SYSTEM',
    entity_id: 'CORE',
    details: 'Emergency response server initialized in standalone mode',
    ip_address: '127.0.0.1',
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
  }
];

export const DEMO_USERS = {
  admin: {
    id: 1,
    username: 'admin',
    email: 'admin@emergency.ops',
    role: 'ADMIN',
    full_name: 'Emergency Operations Director',
    badge_number: 'HQ-001',
  },
  operator: {
    id: 2,
    username: 'operator',
    email: 'operator@emergency.ops',
    role: 'EMERGENCY_OPERATOR',
    full_name: 'Lead Dispatch Officer',
    badge_number: 'DSP-204',
  },
  viewer: {
    id: 3,
    username: 'viewer',
    email: 'viewer@emergency.ops',
    role: 'VIEWER',
    full_name: 'Field Telemetry Monitor',
    badge_number: 'OBS-509',
  },
};

function getStored(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStored(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (_e) {
    // Ignore storage quota errors
  }
}

export const mockDb = {
  getIncidents: () => getStored(STORAGE_KEYS.INCIDENTS, INITIAL_INCIDENTS),
  saveIncidents: (data) => setStored(STORAGE_KEYS.INCIDENTS, data),
  getUnits: () => getStored(STORAGE_KEYS.UNITS, INITIAL_UNITS),
  saveUnits: (data) => setStored(STORAGE_KEYS.UNITS, data),
  getNotifications: () => getStored(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS),
  saveNotifications: (data) => setStored(STORAGE_KEYS.NOTIFICATIONS, data),
  getLogs: () => getStored(STORAGE_KEYS.LOGS, INITIAL_LOGS),
  saveLogs: (data) => setStored(STORAGE_KEYS.LOGS, data),

  getSummary() {
    const incidents = this.getIncidents();
    const units = this.getUnits();
    const verified = incidents.filter(i => i.verification_status === 'Verified').length;
    const pending = incidents.filter(i => i.verification_status === 'Pending').length;
    const available = units.filter(u => u.status === 'Available').length;
    const highCrit = incidents.filter(i => i.severity === 'High' || i.severity === 'Critical').length;

    return {
      metrics: {
        total_incidents: incidents.length,
        today_incidents: incidents.length,
        active_incidents: incidents.filter(i => i.response_status !== 'Resolved').length,
        verified_incidents: verified,
        pending_verification: pending,
        units_available: available,
        units_assigned: units.length - available,
        high_severity_incidents: highCrit,
        avg_response_minutes: 4.8,
      },
      recent_incidents: incidents.slice(0, 8),
    };
  },

  getAnalytics() {
    return {
      accidents_by_severity: [
        { severity: 'Critical', count: 4 },
        { severity: 'High', count: 9 },
        { severity: 'Medium', count: 14 },
        { severity: 'Low', count: 7 },
      ],
      incidents_by_hour: [
        { hour: '00:00', count: 1 },
        { hour: '04:00', count: 0 },
        { hour: '08:00', count: 5 },
        { hour: '12:00', count: 7 },
        { hour: '16:00', count: 9 },
        { hour: '20:00', count: 4 },
      ],
      unit_status_distribution: [
        { status: 'Available', count: 3 },
        { status: 'Dispatched', count: 1 },
        { status: 'En Route', count: 1 },
        { status: 'Busy', count: 0 },
      ],
    };
  }
};
