/**
 * Demo Mock Data Store & Standalone Simulation Engine
 * Provides complete offline/standalone demo functionality when the Flask backend
 * is not running or when the frontend is deployed to static hosts like Vercel.
 */

const STORAGE_KEYS = {
  INCIDENTS: 'ser_demo_incidents',
  UNITS: 'ser_demo_units',
  NOTIFICATIONS: 'ser_demo_notifications',
  LOGS: 'ser_demo_logs',
  USERS: 'ser_demo_users',
};

export const DEMO_USERS = {
  admin: {
    id: 1,
    username: 'admin',
    email: 'admin@emergency.ops',
    role: 'ADMIN',
    full_name: 'Emergency Operations Director',
    badge_number: 'HQ-001',
    is_active: true,
    created_at: new Date(Date.now() - 365 * 86400000).toISOString(),
  },
  operator: {
    id: 2,
    username: 'operator',
    email: 'operator@emergency.ops',
    role: 'EMERGENCY_OPERATOR',
    full_name: 'Lead Dispatch Officer',
    badge_number: 'DSP-204',
    is_active: true,
    created_at: new Date(Date.now() - 180 * 86400000).toISOString(),
  },
  viewer: {
    id: 3,
    username: 'viewer',
    email: 'viewer@emergency.ops',
    role: 'VIEWER',
    full_name: 'Field Telemetry Monitor',
    badge_number: 'OBS-509',
    is_active: true,
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
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
    latitude: 11.3410,
    longitude: 77.7172,
    address: 'Perundurai Road, Near Collectorate, Erode',
    description: 'Multi-vehicle impact detected at high-traffic crossing. Citizen caller confirmed vehicle damage.',
    severity: 'High',
    ai_confidence: 89.5,
    verification_status: 'Verified',
    response_status: 'Dispatched',
    assigned_unit_id: 2,
    assigned_unit: INITIAL_UNITS[1],
    reporter: 'Citizen (+91 98401 23456)',
    phone_number: '+91 98401 23456',
    phone: '+91 98401 23456',
    verified_by_id: 2,
    verified_by: { username: 'operator' },
    verified_at: new Date(Date.now() - 20 * 60000).toISOString(),
  },
  {
    id: 2,
    incident_id: 'INC-2026-002',
    date_time: new Date(Date.now() - 12 * 60000).toISOString(),
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    latitude: 11.3524,
    longitude: 77.7289,
    address: 'Sathy Road, Veerappanchatram, Erode',
    description: 'Overturned vehicle on road lane 2. Severe obstruction with potential medical distress.',
    severity: 'Critical',
    ai_confidence: 94.2,
    verification_status: 'Verified',
    response_status: 'En Route',
    assigned_unit_id: 4,
    assigned_unit: INITIAL_UNITS[3],
    reporter: 'Citizen (+91 94432 87654)',
    phone_number: '+91 94432 87654',
    phone: '+91 94432 87654',
    verified_by_id: 2,
    verified_by: { username: 'operator' },
    verified_at: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 3,
    incident_id: 'INC-2026-003',
    date_time: new Date(Date.now() - 4 * 60000).toISOString(),
    created_at: new Date(Date.now() - 4 * 60000).toISOString(),
    latitude: 11.3391,
    longitude: 77.7255,
    address: 'Brough Road, Near Clock Tower, Erode',
    description: 'Minor rear-end bumper impact. No flames or structural collapse detected.',
    severity: 'Medium',
    ai_confidence: 72.0,
    verification_status: 'Pending',
    response_status: 'Pending',
    assigned_unit_id: null,
    reporter: 'Citizen (+91 97890 54321)',
    phone_number: '+91 97890 54321',
    phone: '+91 97890 54321',
  },
  {
    id: 4,
    incident_id: 'INC-2026-004',
    date_time: new Date(Date.now() - 1 * 86400000 - 4 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 1 * 86400000 - 4 * 3600000).toISOString(),
    latitude: 11.3452,
    longitude: 77.7121,
    address: 'Chennimalai Road, Overbridge Junction, Erode',
    description: 'Two-wheeler skid collision reported by bystander. First aid dispatched.',
    severity: 'High',
    ai_confidence: 86.4,
    verification_status: 'Verified',
    response_status: 'Resolved',
    assigned_unit_id: 1,
    assigned_unit: INITIAL_UNITS[0],
    reporter: 'Citizen (+91 98942 13579)',
    phone_number: '+91 98942 13579',
    phone: '+91 98942 13579',
  },
  {
    id: 5,
    incident_id: 'INC-2026-005',
    date_time: new Date(Date.now() - 1 * 86400000 - 9 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 1 * 86400000 - 9 * 3600000).toISOString(),
    latitude: 11.3590,
    longitude: 77.7088,
    address: 'Bhavani Main Road, Chithode Ring Road, Erode',
    description: 'Commercial lorry breakdown causing severe traffic pile-up and minor collision.',
    severity: 'Medium',
    ai_confidence: 91.0,
    verification_status: 'Verified',
    response_status: 'Resolved',
    assigned_unit_id: 2,
    assigned_unit: INITIAL_UNITS[1],
    reporter: 'Citizen (+91 94431 98765)',
    phone_number: '+91 94431 98765',
    phone: '+91 94431 98765',
  },
  {
    id: 6,
    incident_id: 'INC-2026-006',
    date_time: new Date(Date.now() - 2 * 86400000 - 5 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 2 * 86400000 - 5 * 3600000).toISOString(),
    latitude: 11.3280,
    longitude: 77.7312,
    address: 'Poondurai Road, Near Railway Colony, Erode',
    description: 'Pedestrian assistance and vehicle side-impact. Immediate ambulance deployment.',
    severity: 'Critical',
    ai_confidence: 95.8,
    verification_status: 'Verified',
    response_status: 'Resolved',
    assigned_unit_id: 1,
    assigned_unit: INITIAL_UNITS[0],
    reporter: 'Citizen (+91 98422 65432)',
    phone_number: '+91 98422 65432',
    phone: '+91 98422 65432',
  },
  {
    id: 7,
    incident_id: 'INC-2026-007',
    date_time: new Date(Date.now() - 3 * 86400000 - 3 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 3 * 86400000 - 3 * 3600000).toISOString(),
    latitude: 11.3365,
    longitude: 77.7198,
    address: 'Gandhiji Road, Near PS Park, Erode',
    description: 'Side-mirror scrape between city bus and auto-rickshaw. No injuries reported.',
    severity: 'Low',
    ai_confidence: 78.2,
    verification_status: 'Verified',
    response_status: 'Resolved',
    assigned_unit_id: null,
    reporter: 'Citizen (+91 97910 87654)',
    phone_number: '+91 97910 87654',
    phone: '+91 97910 87654',
  },
  {
    id: 8,
    incident_id: 'INC-2026-008',
    date_time: new Date(Date.now() - 4 * 86400000 - 7 * 3600000).toISOString(),
    created_at: new Date(Date.now() - 4 * 86400000 - 7 * 3600000).toISOString(),
    latitude: 11.3488,
    longitude: 77.7350,
    address: 'Meenatchi Sundaranar Road, Near Bus Stand, Erode',
    description: 'Delivery vehicle slide on wet pavement. Traffic patrol cleared obstruction.',
    severity: 'High',
    ai_confidence: 88.0,
    verification_status: 'Verified',
    response_status: 'Resolved',
    assigned_unit_id: 2,
    assigned_unit: INITIAL_UNITS[1],
    reporter: 'Citizen (+91 98405 11223)',
    phone_number: '+91 98405 11223',
    phone: '+91 98405 11223',
  }
];

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    title: 'CRITICAL: Severe Rollover Incident Verified',
    message: 'INC-2026-002 on Sathy Road, Veerappanchatram verified by operator. Unit POL-202 en route.',
    type: 'Critical',
    is_read: false,
    created_at: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 2,
    title: 'New AI Incident Detection Ticket',
    message: 'High confidence collision detected at Brough Road, Clock Tower. Awaiting human verification.',
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
    details: 'Emergency response server initialized in standalone simulation mode',
    ip_address: '127.0.0.1',
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
  }
];

export function cleanLocation(addr) {
  if (!addr || typeof addr !== 'string') return 'Perundurai Road, Erode, Tamil Nadu';
  let cleaned = addr
    .replace(/Live Tested GPS Position\s*(\(±\d+m\))?/gi, '')
    .replace(/Live Tested Citizen SOS\s*•?\s*/gi, '')
    .replace(/Live Citizen SOS\s*•?\s*/gi, '')
    .replace(/Current Device Location/gi, '')
    .trim();
  // Remove leading bullets, commas, dashes
  cleaned = cleaned.replace(/^[•\-\,\s]+/, '').trim();
  if (!cleaned || cleaned.length < 2) {
    return 'Perundurai Road, Erode, Tamil Nadu';
  }
  return cleaned;
}

export const REALISTIC_CITIZEN_PHONES = [
  '+91 98401 23456',
  '+91 94432 87654',
  '+91 97890 54321',
  '+91 98942 13579',
  '+91 94431 98765',
  '+91 98422 65432',
  '+91 97910 87654',
  '+91 98405 11223',
];

export const SAMPLE_ACCIDENT_PHOTO = 'https://images.unsplash.com/photo-1599423300746-b62533397364?w=600&auto=format&fit=crop&q=80';

export function isDummyPhoneNumber(num) {
  if (!num) return true;
  const s = String(num).trim();
  return (
    REALISTIC_CITIZEN_PHONES.includes(s) ||
    s.toLowerCase().includes('test0') ||
    s.includes('94431 98765') ||
    s.includes('94431') ||
    s.includes('Citizen') ||
    s.includes('Not Provided') ||
    s.includes('test')
  );
}

export function cleanPhoneNumber(phone, fallbackSeed = '') {
  // 1. Check if user typed their real phone number
  if (typeof window !== 'undefined') {
    try {
      const userPhone = localStorage.getItem('ser_user_phone');
      if (userPhone && !isDummyPhoneNumber(userPhone) && /\d{4,}/.test(userPhone.trim())) {
        // If the phone passed in is dummy or empty, use the real user phone!
        if (isDummyPhoneNumber(phone)) {
          return userPhone.trim();
        }
      } else if (userPhone && isDummyPhoneNumber(userPhone)) {
        // Purge dummy number accidentally stored in user phone slot
        localStorage.removeItem('ser_user_phone');
      }
    } catch {}
  }

  const trimmed = typeof phone === 'string' ? phone.trim() : '';

  // If phone passed in is a real phone number entered by user, return it directly!
  if (trimmed && !isDummyPhoneNumber(trimmed) && /\d{4,}/.test(trimmed)) {
    return trimmed;
  }

  // Check userPhone in storage again
  if (typeof window !== 'undefined') {
    try {
      const userPhone = localStorage.getItem('ser_user_phone');
      if (userPhone && !isDummyPhoneNumber(userPhone) && /\d{4,}/.test(userPhone.trim())) {
        return userPhone.trim();
      }
    } catch {}
  }

  // Assign deterministic realistic citizen mobile number from pool
  let hash = 0;
  const str = String(fallbackSeed || 'INC-101');
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % REALISTIC_CITIZEN_PHONES.length;
  }
  return REALISTIC_CITIZEN_PHONES[Math.abs(hash) % REALISTIC_CITIZEN_PHONES.length];
}

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
  getIncidents: () => {
    const raw = getStored(STORAGE_KEYS.INCIDENTS, null);
    let source = Array.isArray(raw) ? raw : INITIAL_INCIDENTS;
    let mutated = false;

    const sanitized = source.map((inc, idx) => {
      let changed = false;
      let newAddress = inc.address;
      if (typeof inc.address === 'string' && (inc.address.includes('Live Tested') || inc.address.includes('GPS Position (±'))) {
        newAddress = cleanLocation(inc.address);
        changed = true;
      }
      let currentPhone = inc.phone_number || inc.phone || '';
      const validPhone = cleanPhoneNumber(currentPhone, inc.incident_id || inc.id || idx);
      if (validPhone !== currentPhone) {
        currentPhone = validPhone;
        changed = true;
      }
      let newReporter = inc.reporter || '';
      if (!newReporter || newReporter.includes('TEST0') || newReporter === 'Citizen Mobile Caller' || newReporter === 'Citizen Mobile SOS' || newReporter === 'Citizen') {
        newReporter = `Citizen (${currentPhone})`;
        changed = true;
      }
      if (!inc.photo) {
        inc.photo = SAMPLE_ACCIDENT_PHOTO;
        changed = true;
      }
      if (changed) mutated = true;
      return {
        ...inc,
        address: newAddress,
        phone_number: currentPhone,
        phone: currentPhone,
        reporter: newReporter,
      };
    });

    if (mutated) {
      mockDb.saveIncidents(sanitized);
    }
    return sanitized;
  },
  saveIncidents: (data) => {
    if (!Array.isArray(data)) return;
    // Guard against localStorage quota exceeded: strip huge multi-megabyte base64 strings
    const safe = data.map((item) => {
      if (item.photo && typeof item.photo === 'string' && item.photo.length > 50000) {
        try {
          localStorage.setItem(`ser_sos_photo_${item.id || item.incident_id}`, item.photo);
        } catch {}
        return {
          ...item,
          photo: item.photo.startsWith('http') ? item.photo : SAMPLE_ACCIDENT_PHOTO,
        };
      }
      return item;
    });
    setStored(STORAGE_KEYS.INCIDENTS, safe);
  },
  getUnits: () => getStored(STORAGE_KEYS.UNITS, INITIAL_UNITS),
  saveUnits: (data) => setStored(STORAGE_KEYS.UNITS, data),
  getNotifications: () => {
    const raw = getStored(STORAGE_KEYS.NOTIFICATIONS, INITIAL_NOTIFICATIONS);
    let mutated = false;
    const sanitized = raw.map((notif) => {
      let changed = false;
      let newAddress = notif.address;
      if (typeof notif.address === 'string' && (notif.address.includes('Live Tested') || notif.address.includes('GPS Position (±'))) {
        newAddress = cleanLocation(notif.address);
        changed = true;
      }
      let newMsg = notif.message || '';
      let newTitle = notif.title || '';
      let newType = notif.type || notif.emergency_type || 'Medical';
      const notifPhone = cleanPhoneNumber(notif.reporter_phone || notif.phone || '', notif.id);
      const notifPhoto = notif.photo || (typeof window !== 'undefined' ? localStorage.getItem('ser_latest_sos_photo') : null) || SAMPLE_ACCIDENT_PHOTO;

      if (newMsg.includes('Medical distress call. Emergency alarm and dispatch modal verification')) {
        newMsg = newMsg.replace('Medical distress call. Emergency alarm and dispatch modal verification', 'Emergency distress call. Immediate responder dispatch.');
      }
      if (newMsg.includes('Live Tested') || newMsg.includes('TEST0')) {
        newMsg = newMsg
          .replace(/Live Tested GPS Position\s*(\(±\d+m\))?/gi, cleanLocation(notif.address || ''))
          .replace(/Live Tested Citizen SOS\s*•?\s*/gi, '')
          .replace(/\+91-98765-TEST0/g, notifPhone);
        changed = true;
      }
      if (!notif.photo) {
        notif.photo = notifPhoto;
        changed = true;
      }
      if (notif.reporter_phone !== notifPhone) {
        notif.reporter_phone = notifPhone;
        changed = true;
      }
      if (changed) mutated = true;
      return {
        ...notif,
        address: newAddress,
        message: newMsg,
        title: newTitle,
        type: newType,
        reporter_phone: notifPhone,
        phone: notifPhone,
        photo: notifPhoto,
      };
    });
    if (mutated) {
      setStored(STORAGE_KEYS.NOTIFICATIONS, sanitized);
    }
    return sanitized;
  },
  saveNotifications: (data) => {
    if (!Array.isArray(data)) return;
    const safe = data.map((item) => {
      if (item.photo && typeof item.photo === 'string' && item.photo.length > 50000) {
        return {
          ...item,
          photo: item.photo.startsWith('http') ? item.photo : SAMPLE_ACCIDENT_PHOTO,
        };
      }
      return item;
    });
    setStored(STORAGE_KEYS.NOTIFICATIONS, safe);
  },
  getLogs: () => getStored(STORAGE_KEYS.LOGS, INITIAL_LOGS),
  saveLogs: (data) => setStored(STORAGE_KEYS.LOGS, data),
  getUsers: () => getStored(STORAGE_KEYS.USERS, Object.values(DEMO_USERS)),
  saveUsers: (data) => setStored(STORAGE_KEYS.USERS, data),

  addLog(action, entity, details, username = 'operator') {
    const logs = this.getLogs();
    const newLog = {
      id: Date.now(),
      username,
      action,
      entity,
      entity_id: String(Date.now()).slice(-4),
      details,
      ip_address: '127.0.0.1',
      created_at: new Date().toISOString(),
    };
    logs.unshift(newLog);
    this.saveLogs(logs.slice(0, 50));
  },

  getSummary() {
    const incidents = this.getIncidents();
    const units = this.getUnits();
    const verified = incidents.filter(i => i.verification_status === 'Verified').length;
    const pending = incidents.filter(i => i.verification_status === 'Pending').length;
    const available = units.filter(u => u.status === 'Available').length;
    const highCrit = incidents.filter(i => i.severity === 'High' || i.severity === 'Critical').length;
    
    // Compute today's accidents and daily average
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = incidents.filter(i => (i.date_time || i.created_at || '').startsWith(todayStr)).length;
    const avgPerDay = incidents.length > 0 ? (incidents.length / Math.max(1, 7)).toFixed(1) : 0;

    return {
      metrics: {
        total_incidents: incidents.length,
        today_incidents: todayCount,
        accidents_per_day: avgPerDay,
        accidents_today: todayCount,
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
    const incidents = this.getIncidents();
    const units = this.getUnits();

    // Group by day for last 7 days (Accidents per day)
    const daysMap = {};
    for (let d = 6; d >= 0; d--) {
      const dateObj = new Date(Date.now() - d * 86400000);
      const dateKey = dateObj.toISOString().split('T')[0];
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      daysMap[dateKey] = { date: dateKey, day: dayName, incidents: 0, accidents: 0 };
    }

    incidents.forEach(inc => {
      const dateKey = (inc.date_time || inc.created_at || '').split('T')[0];
      if (daysMap[dateKey]) {
        daysMap[dateKey].incidents += 1;
        daysMap[dateKey].accidents += 1;
      }
    });

    const byDay = Object.values(daysMap);
    const totalWeekAccidents = byDay.reduce((acc, curr) => acc + curr.incidents, 0);
    const avgPerDay = (totalWeekAccidents / 7).toFixed(1);

    const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    incidents.forEach(inc => {
      const s = inc.severity || 'Medium';
      if (severityCounts[s] !== undefined) severityCounts[s]++;
      else severityCounts.Medium++;
    });

    const bySeverity = Object.entries(severityCounts).map(([name, count]) => ({ name, count }));

    const statusCounts = {};
    incidents.forEach(inc => {
      const st = inc.response_status || 'Pending';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });
    const byStatus = Object.entries(statusCounts).map(([name, count]) => ({ name, count }));

    const locMap = {};
    incidents.forEach(inc => {
      const loc = inc.address ? inc.address.split(',')[0].trim() : 'Chennai Central';
      locMap[loc] = (locMap[loc] || 0) + 1;
    });
    const byLocation = Object.entries(locMap)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);

    return {
      accidents_per_day_avg: avgPerDay,
      by_day: byDay,
      by_severity: bySeverity,
      by_status: byStatus,
      by_location: byLocation,
      accidents_by_severity: bySeverity,
      incidents_by_hour: [
        { hour: '00:00', count: 1 },
        { hour: '04:00', count: 0 },
        { hour: '08:00', count: 5 },
        { hour: '12:00', count: 7 },
        { hour: '16:00', count: 9 },
        { hour: '20:00', count: 4 },
      ],
      unit_status_distribution: [
        { status: 'Available', count: units.filter(u => u.status === 'Available').length },
        { status: 'Dispatched', count: units.filter(u => u.status === 'Dispatched').length },
        { status: 'En Route', count: units.filter(u => u.status === 'En Route').length },
        { status: 'Busy', count: units.filter(u => u.status === 'Busy').length },
      ],
    };
  }
};

/**
 * Creates an Axios-compatible synthetic HTTP response
 */
function mockResponse(data, status = 200, statusText = 'OK') {
  return Promise.resolve({
    data,
    status,
    statusText,
    headers: { 'content-type': 'application/json' },
    config: {},
  });
}

/**
 * Dispatches API calls to the local mock simulation store
 */
export async function handleMockRequest(config) {
  const url = (config.url || '').split('?')[0].replace(/^\/api/, '');
  const method = (config.method || 'get').toLowerCase();
  const params = config.params || {};
  
  let body = config.data;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // Non-JSON body
    }
  }

  // -------------------------------------------------------------
  // AUTH ROUTES
  // -------------------------------------------------------------
  if (url === '/auth/login' && method === 'post') {
    const rawUsername = (body?.username || '').trim().toLowerCase();
    const rawPassword = (body?.password || '').trim();

    // Verify authorized dispatch credentials
    if (
      (rawUsername === 'admin' && (rawPassword === 'Admin@123' || rawPassword === 'admin')) ||
      (rawUsername === 'operator' && (rawPassword === 'Operator@123' || rawPassword === 'operator'))
    ) {
      const user = rawUsername === 'admin' ? DEMO_USERS.admin : DEMO_USERS.operator;
      const token = `ser-auth-jwt-${user.role.toLowerCase()}-${Date.now()}`;
      mockDb.addLog('LOGIN', 'User', `Authorized dispatch personnel ${user.username} authenticated`, user.username);

      return mockResponse({
        message: 'Authentication granted. Accessing Emergency Terminal.',
        token,
        user,
      });
    }

    // Reject all unauthorized access
    return Promise.reject({
      response: {
        status: 401,
        data: { error: 'Access Denied: Invalid call-sign or dispatch security password.' },
      },
      message: 'Unauthorized dispatch access',
    });
  }

  if (url === '/auth/register' && method === 'post') {
    const newUser = {
      id: Date.now(),
      username: body?.username || 'new_operator',
      email: body?.email || 'new@emergency.ops',
      role: body?.role || 'EMERGENCY_OPERATOR',
      full_name: body?.full_name || body?.username || 'Field Personnel',
      badge_number: 'DSP-' + Math.floor(100 + Math.random() * 900),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const users = mockDb.getUsers();
    users.push(newUser);
    mockDb.saveUsers(users);
    mockDb.addLog('REGISTER', 'User', `Registered new operator ${newUser.username}`, newUser.username);

    return mockResponse({
      message: 'Registration successful',
      token: `ser-demo-jwt-reg-${Date.now()}`,
      user: newUser,
    }, 201);
  }

  if (url === '/auth/me' && method === 'get') {
    const saved = localStorage.getItem('ser_user');
    const user = saved ? JSON.parse(saved) : DEMO_USERS.admin;
    return mockResponse({ user });
  }

  if (url === '/auth/logout' && method === 'post') {
    return mockResponse({ message: 'Logged out successfully' });
  }

  if (url === '/auth/change-password' && method === 'put') {
    return mockResponse({ message: 'Password updated successfully' });
  }

  // -------------------------------------------------------------
  // DASHBOARD ROUTES
  // -------------------------------------------------------------
  if (url === '/dashboard/summary') {
    return mockResponse(mockDb.getSummary());
  }

  if (url === '/dashboard/analytics') {
    return mockResponse(mockDb.getAnalytics());
  }

  // -------------------------------------------------------------
  // ACCIDENTS / INCIDENTS ROUTES
  // -------------------------------------------------------------
  if (url === '/accidents' && method === 'get') {
    let list = mockDb.getIncidents();
    const params = config.params || {};

    if (params.severity) {
      list = list.filter(i => i.severity.toLowerCase() === params.severity.toLowerCase());
    }
    if (params.verification_status) {
      list = list.filter(i => i.verification_status.toLowerCase() === params.verification_status.toLowerCase());
    }
    if (params.response_status) {
      list = list.filter(i => i.response_status.toLowerCase() === params.response_status.toLowerCase());
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(i => 
        i.incident_id?.toLowerCase().includes(q) ||
        i.address?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.phone_number?.toLowerCase().includes(q) ||
        i.reporter?.toLowerCase().includes(q)
      );
    }

    return mockResponse({
      accidents: list,
      total: list.length,
      page: 1,
      per_page: 50,
    });
  }

  if (url === '/accidents' && method === 'delete') {
    mockDb.saveIncidents([]);
    return mockResponse({ message: 'All accidents cleared successfully' });
  }

  const accidentMatch = url.match(/^\/accidents\/([^/]+)$/);
  if (accidentMatch) {
    const id = accidentMatch[1];
    const incidents = mockDb.getIncidents();
    const index = incidents.findIndex(i => String(i.id) === id || i.incident_id === id);

    if (method === 'get') {
      const inc = incidents[index] || incidents[0];
      return mockResponse({ accident: inc });
    }

    if (method === 'put') {
      if (index !== -1) {
        incidents[index] = { ...incidents[index], ...body, updated_at: new Date().toISOString() };
        mockDb.saveIncidents(incidents);
        mockDb.addLog('UPDATE', 'Accident', `Updated incident ${incidents[index].incident_id}`);
        return mockResponse({ accident: incidents[index], message: 'Incident updated' });
      }
      return mockResponse({ accident: body, message: 'Updated' });
    }

    if (method === 'delete') {
      if (index !== -1) {
        incidents.splice(index, 1);
        mockDb.saveIncidents(incidents);
      }
      return mockResponse({ message: 'Incident deleted successfully' });
    }
  }

  if (url === '/accidents' && method === 'post') {
    const incidents = mockDb.getIncidents();
    const cleanAddr = cleanLocation(body?.address);
    const desc = body?.description || '';
    const detectedType = body?.emergency_type || body?.emergencyType || body?.type || (
      /traffic|crash|collision/i.test(desc) ? 'Traffic' :
      /police|crime/i.test(desc) ? 'Police' :
      /fire/i.test(desc) ? 'Fire' :
      /medical|ambulance|health|injury/i.test(desc) ? 'Medical' :
      'Medical'
    );
    const userPhone = cleanPhoneNumber(body?.phone || body?.reporter_phone || body?.phone_number || (typeof body?.reporter === 'string' && body.reporter.match(/\+?\d[\d\-\s]{6,}/)?.[0] ? body.reporter : ''), Date.now());
    const photo = body?.photo || body?.photo_url || null;
    const reporterLabel = userPhone ? `Citizen (${userPhone})` : 'Citizen Direct';
    const targetId = body?.id || body?.incident_id || Date.now();
    const targetCode = body?.incident_id || (typeof body?.id === 'string' && body.id.startsWith('SOS-') ? body.id : `INC-2026-${String(incidents.length + 1).padStart(3, '0')}`);

    // Check if incident already exists to prevent duplicate on repeated background sync
    const existingIndex = incidents.findIndex(i => String(i.id) === String(targetId) || String(i.incident_id) === String(targetCode));

    const newInc = {
      id: targetId,
      incident_id: targetCode,
      date_time: body?.date_time || body?.timestamp || new Date().toISOString(),
      created_at: body?.created_at || body?.timestamp || new Date().toISOString(),
      latitude: Number(body?.latitude || 11.3410),
      longitude: Number(body?.longitude || 77.7172),
      address: cleanAddr,
      description: body?.description ? body.description.replace(/Live Tested [^\.]+\./gi, '').replace(/\+91-98765-TEST0/g, userPhone) : `[CITIZEN SOS] ${detectedType} emergency reported`,
      severity: body?.severity || 'Critical',
      emergency_type: detectedType,
      type: detectedType,
      ai_confidence: body?.ai_confidence || 98.5,
      verification_status: body?.verification_status || 'Verified',
      response_status: 'Pending',
      assigned_unit_id: null,
      reporter: reporterLabel,
      phone_number: userPhone,
      phone: userPhone,
      photo: photo,
    };

    if (existingIndex !== -1) {
      incidents[existingIndex] = { ...incidents[existingIndex], ...newInc };
    } else {
      incidents.unshift(newInc);
    }
    mockDb.saveIncidents(incidents);

    // Add or update alert notification with clean message, correct type, photo, and phone
    const notifs = mockDb.getNotifications();
    const notifIndex = notifs.findIndex(n => String(n.id) === String(targetId) || String(n.incident_id) === String(targetId) || String(n.incident_code) === String(targetCode));
    const notifItem = {
      id: targetId,
      title: `CRITICAL: ${newInc.incident_id} Reported (${detectedType})`,
      message: `${newInc.address} - [CITIZEN SOS] ${detectedType} distress call. Contact: ${userPhone}. ${body?.notes || ''}`,
      type: detectedType,
      severity: 'critical',
      is_read: false,
      latitude: newInc.latitude,
      longitude: newInc.longitude,
      address: newInc.address,
      incident_id: newInc.id,
      incident_code: newInc.incident_id,
      photo: newInc.photo,
      reporter_phone: userPhone,
      phone: userPhone,
      created_at: newInc.created_at,
    };

    if (notifIndex !== -1) {
      notifs[notifIndex] = { ...notifs[notifIndex], ...notifItem };
    } else {
      notifs.unshift(notifItem);
    }
    mockDb.saveNotifications(notifs);
    mockDb.addLog('CREATE', 'Accident', `Registered ticket ${newInc.incident_id} (${detectedType})`);

    // Persist as active SOS and dispatch event
    if (typeof window !== 'undefined') {
      try {
        const emergencyPayload = {
          id: targetId,
          type: detectedType,
          emergencyType: detectedType,
          latitude: newInc.latitude,
          longitude: newInc.longitude,
          address: newInc.address,
          notes: newInc.description,
          phone: userPhone,
          reporter_phone: userPhone,
          photo: newInc.photo,
          urgency: newInc.severity,
          timestamp: newInc.created_at,
          source: 'INCIDENT_REPORT',
        };
        localStorage.setItem('ser_active_sos', JSON.stringify(emergencyPayload));
        window.dispatchEvent(new CustomEvent('ser_emergency_sos', { detail: emergencyPayload }));
      } catch {}
    }

    return mockResponse({ accident: newInc, message: 'Accident recorded successfully' }, 201);
  }

  const verifyMatch = url.match(/^\/accidents\/([^/]+)\/verify$/);
  if (verifyMatch && method === 'put') {
    const id = verifyMatch[1];
    const incidents = mockDb.getIncidents();
    const index = incidents.findIndex(i => String(i.id) === id || i.incident_id === id);

    if (index !== -1) {
      incidents[index].verification_status = body?.verification_status || 'Verified';
      if (body?.severity) incidents[index].severity = body.severity;
      incidents[index].verified_at = new Date().toISOString();
      incidents[index].verified_by = { username: 'operator' };
      mockDb.saveIncidents(incidents);
      mockDb.addLog('VERIFY', 'Accident', `Verified incident ${incidents[index].incident_id}`);
      return mockResponse({ accident: incidents[index], message: 'Verification recorded' });
    }
    return mockResponse({ message: 'Verified' });
  }

  const statusMatch = url.match(/^\/accidents\/([^/]+)\/status$/);
  if (statusMatch && method === 'put') {
    const id = statusMatch[1];
    const incidents = mockDb.getIncidents();
    const index = incidents.findIndex(i => String(i.id) === id || i.incident_id === id);

    if (index !== -1) {
      incidents[index].response_status = body?.response_status || body?.status || 'In Progress';
      mockDb.saveIncidents(incidents);
      mockDb.addLog('STATUS_CHANGE', 'Accident', `Status updated to ${incidents[index].response_status}`);
      return mockResponse({ accident: incidents[index], message: 'Status updated' });
    }
    return mockResponse({ message: 'Status updated' });
  }

  // -------------------------------------------------------------
  // EMERGENCY UNITS ROUTES
  // -------------------------------------------------------------
  if (url === '/emergency-units' && method === 'get') {
    const units = mockDb.getUnits();
    return mockResponse({ units, total: units.length });
  }

  if (url === '/emergency-units' && method === 'post') {
    const units = mockDb.getUnits();
    const newUnit = {
      id: Date.now(),
      unit_id: body?.unit_id || `UNIT-${Math.floor(100 + Math.random() * 900)}`,
      vehicle_number: body?.vehicle_number || 'EMERG-00',
      type: body?.type || 'Ambulance',
      driver_name: body?.driver_name || 'Emergency Responder',
      contact_number: body?.contact_number || '+1-555-0199',
      status: body?.status || 'Available',
      latitude: body?.latitude || 40.7300,
      longitude: body?.longitude || -73.9900,
      created_at: new Date().toISOString(),
    };
    units.push(newUnit);
    mockDb.saveUnits(units);
    mockDb.addLog('CREATE', 'Unit', `Added unit ${newUnit.unit_id}`);
    return mockResponse({ unit: newUnit, message: 'Unit created' }, 201);
  }

  const unitMatch = url.match(/^\/emergency-units\/([^/]+)$/);
  if (unitMatch) {
    const id = unitMatch[1];
    const units = mockDb.getUnits();
    const index = units.findIndex(u => String(u.id) === id || u.unit_id === id);

    if (method === 'get') {
      return mockResponse({ unit: units[index] || units[0] });
    }

    if (method === 'put') {
      if (index !== -1) {
        units[index] = { ...units[index], ...body };
        mockDb.saveUnits(units);
        return mockResponse({ unit: units[index], message: 'Unit updated' });
      }
      return mockResponse({ unit: body, message: 'Unit updated' });
    }

    if (method === 'delete') {
      if (index !== -1) {
        units.splice(index, 1);
        mockDb.saveUnits(units);
      }
      return mockResponse({ message: 'Unit removed' });
    }
  }

  // -------------------------------------------------------------
  // ASSIGNMENTS ROUTES
  // -------------------------------------------------------------
  if (url === '/assignments' && method === 'post') {
    const units = mockDb.getUnits();
    const incidents = mockDb.getIncidents();

    const unit = units.find(u => String(u.id) === String(body?.unit_id));
    const incident = incidents.find(i => String(i.id) === String(body?.accident_id));

    if (unit) {
      unit.status = 'Dispatched';
      mockDb.saveUnits(units);
    }
    if (incident) {
      incident.response_status = 'Dispatched';
      incident.assigned_unit_id = body?.unit_id;
      incident.assigned_unit = unit;
      mockDb.saveIncidents(incidents);
    }

    mockDb.addLog('DISPATCH', 'Assignment', `Dispatched unit ${unit?.unit_id || ''} to ${incident?.incident_id || ''}`);
    return mockResponse({ message: 'Unit dispatched successfully' }, 201);
  }

  if (url === '/assignments' && method === 'get') {
    return mockResponse({ assignments: [] });
  }

  // -------------------------------------------------------------
  // AI VISION INFERENCE SIMULATION
  // -------------------------------------------------------------
  if (url === '/ai/status') {
    return mockResponse({
      status: 'Online',
      model_name: 'YOLOv8-Emergency-Accident-Detector',
      version: 'v2.4.0',
      device: 'WebGL / WebWorker Accelerated',
      latency_ms: 38,
      is_loaded: true,
      classes: ['Car Collision', 'Overturned Vehicle', 'Fire/Smoke', 'Pedestrian Hazard'],
    });
  }

  if (url === '/ai/analyze-image' || url === '/ai/analyze-video') {
    const isVideo = url.includes('video');
    const detectionId = Math.floor(1000 + Math.random() * 9000);

    return mockResponse({
      message: `${isVideo ? 'Video' : 'Image'} analysis completed successfully`,
      detection: {
        id: detectionId,
        detection_uuid: `det-${Math.random().toString(36).substring(2, 9)}`,
        media_type: isVideo ? 'video' : 'image',
        media_filename: isVideo ? 'traffic_feed.mp4' : 'uploaded_accident_scan.jpg',
        is_accident_detected: true,
        confidence_score: 93.4,
        severity: 'High',
        detected_objects: ['Vehicle Collision', 'Front End Deformation', 'Debris Field'],
        model_version: 'YOLOv8-SER-v2.4',
        inference_time_ms: 42,
        created_at: new Date().toISOString(),
      },
      inference_details: {
        collision_detected: true,
        confidence: 0.934,
        severity: 'High',
        objects: [
          { label: 'Vehicle Collision', confidence: 0.934, box: [120, 140, 480, 360], severity: 'High' },
          { label: 'Impact Zone', confidence: 0.88, box: [180, 220, 340, 330], severity: 'Medium' }
        ]
      }
    });
  }

  if (url === '/ai/detections') {
    const incidents = mockDb.getIncidents();
    const detections = incidents.map(i => ({
      id: i.id,
      severity: i.severity,
      confidence_score: i.ai_confidence || 88.5,
      is_accident_detected: true,
      created_at: i.created_at,
      media_filename: 'cctv_frame.jpg',
    }));
    return mockResponse({ detections, total: detections.length });
  }

  // -------------------------------------------------------------
  // NOTIFICATIONS
  // -------------------------------------------------------------
  if (url === '/notifications' && method === 'get') {
    const notifs = mockDb.getNotifications();
    return mockResponse({
      notifications: notifs,
      unread_count: notifs.filter(n => !n.is_read).length,
      total: notifs.length,
    });
  }

  if (url.match(/^\/notifications\/[^/]+\/read$/) && method === 'put') {
    const notifs = mockDb.getNotifications();
    const id = url.split('/')[2];
    const n = notifs.find(item => String(item.id) === id);
    if (n) n.is_read = true;
    mockDb.saveNotifications(notifs);
    return mockResponse({ message: 'Marked read' });
  }

  if (url === '/notifications/read-all' && method === 'put') {
    const notifs = mockDb.getNotifications();
    notifs.forEach(n => { n.is_read = true; });
    mockDb.saveNotifications(notifs);
    return mockResponse({ message: 'All notifications marked as read' });
  }

  if (url.match(/^\/notifications\/[^/]+$/) && method === 'delete') {
    const id = url.split('/')[2];
    let notifs = mockDb.getNotifications();
    notifs = notifs.filter(n => String(n.id) !== id);
    mockDb.saveNotifications(notifs);
    return mockResponse({ message: 'Notification removed' });
  }

  if (url === '/notifications' && method === 'delete') {
    mockDb.saveNotifications([]);
    return mockResponse({ message: 'All notifications deleted' });
  }

  // -------------------------------------------------------------
  // REPORTS
  // -------------------------------------------------------------
  if (url.startsWith('/reports/accidents') && method === 'get') {
    let list = mockDb.getIncidents();
    if (params.severity) {
      list = list.filter(i => (i.severity || '').toLowerCase() === params.severity.toLowerCase());
    }
    if (params.verification_status) {
      list = list.filter(i => (i.verification_status || '').toLowerCase() === params.verification_status.toLowerCase());
    }
    if (params.response_status) {
      list = list.filter(i => (i.response_status || '').toLowerCase() === params.response_status.toLowerCase());
    }
    if (params.start_date) {
      const s = new Date(params.start_date).getTime();
      list = list.filter(i => new Date(i.date_time).getTime() >= s);
    }
    if (params.end_date) {
      const e = new Date(params.end_date).getTime() + 86400000;
      list = list.filter(i => new Date(i.date_time).getTime() <= e);
    }

    const verified = list.filter(i => i.verification_status === 'Verified').length;
    const rejected = list.filter(i => i.verification_status === 'Rejected').length;
    const pending = list.filter(i => i.verification_status === 'Pending').length;

    // Daily breakdown: count incidents per day
    let dailyBreakdown = [];
    if (list.length > 0) {
      const dailyMap = {};
      list.forEach(inc => {
        const d = inc.date_time ? inc.date_time.split('T')[0] : (inc.created_at ? inc.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
        dailyMap[d] = (dailyMap[d] || 0) + 1;
      });
      dailyBreakdown = Object.entries(dailyMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return mockResponse({
      total: list.length,
      summary: {
        verified,
        rejected,
        pending,
      },
      daily_breakdown: dailyBreakdown,
      records: list,
    });
  }

  if (url.startsWith('/reports/severity') && method === 'get') {
    let list = mockDb.getIncidents();
    if (params.severity) {
      list = list.filter(i => (i.severity || '').toLowerCase() === params.severity.toLowerCase());
    }
    if (params.verification_status) {
      list = list.filter(i => (i.verification_status || '').toLowerCase() === params.verification_status.toLowerCase());
    }
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    list.forEach(i => {
      const sev = i.severity || 'Medium';
      if (counts[sev] !== undefined) {
        counts[sev] += 1;
      } else {
        counts[sev] = 1;
      }
    });
    const severity_distribution = Object.entries(counts).map(([severity, count]) => ({
      severity,
      count,
    }));
    return mockResponse({ severity_distribution });
  }

  if (url.startsWith('/reports/response-time') && method === 'get') {
    const units = mockDb.getUnits();
    const response_times_by_type = [
      { unit_type: 'Ambulance', dispatches_tracked: 14, avg_dispatch_minutes: 4.2 },
      { unit_type: 'Police', dispatches_tracked: 22, avg_dispatch_minutes: 3.1 },
      { unit_type: 'Fire & Rescue', dispatches_tracked: 6, avg_dispatch_minutes: 5.8 },
    ];
    return mockResponse({
      response_times_by_type,
      unit_usage: units.map(u => ({
        unit_id: u.unit_id,
        vehicle_number: u.vehicle_number,
        type: u.type,
        total_assignments: Math.floor(Math.random() * 8 + 3),
        current_status: u.status,
      })),
    });
  }

  if (url.startsWith('/reports/daily') && method === 'get') {
    let list = mockDb.getIncidents();
    const dailyMap = {};
    list.forEach(inc => {
      const d = inc.date_time ? inc.date_time.split('T')[0] : new Date().toISOString().split('T')[0];
      dailyMap[d] = (dailyMap[d] || 0) + 1;
    });
    for (let i = 4; i >= 0; i--) {
      const dayStr = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      if (!dailyMap[dayStr]) {
        dailyMap[dayStr] = i === 0 ? Math.max(1, list.length) : [2, 4, 1, 3][i % 4];
      }
    }
    const dailyData = Object.entries(dailyMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return mockResponse({ daily: dailyData, total: list.length });
  }

  if (url.startsWith('/reports/export-csv')) {
    const incidents = mockDb.getIncidents();
    let csv = 'Incident ID,Date/Time,Address,Severity,Verification Status,Response Status,Citizen Phone,Reporter\n';
    incidents.forEach(i => {
      csv += `"${i.incident_id}","${i.date_time}","${i.address}","${i.severity}","${i.verification_status}","${i.response_status}","${i.phone_number || ''}","${i.reporter || ''}"\n`;
    });
    return mockResponse({ csv, message: 'CSV generated successfully' });
  }

  if (url.startsWith('/reports/')) {
    const analytics = mockDb.getAnalytics();
    return mockResponse({
      report_data: analytics,
      total_records: mockDb.getIncidents().length,
      generated_at: new Date().toISOString(),
    });
  }

  // -------------------------------------------------------------
  // USERS & AUDIT LOGS
  // -------------------------------------------------------------
  if (url === '/users' && method === 'get') {
    return mockResponse({ users: mockDb.getUsers() });
  }

  if (url.match(/^\/users\/[^/]+\/role$/) && method === 'put') {
    return mockResponse({ message: 'User role updated successfully' });
  }

  if (url.match(/^\/users\/[^/]+$/) && method === 'delete') {
    return mockResponse({ message: 'User deleted' });
  }

  if (url === '/users/audit-logs') {
    const logs = mockDb.getLogs();
    return mockResponse({ logs, total: logs.length });
  }

  if (url === '/health') {
    return mockResponse({ status: 'healthy', database: 'connected', mode: 'demo' });
  }

  // Fallback for any unknown route
  return mockResponse({ message: 'Mock response', success: true });
}
