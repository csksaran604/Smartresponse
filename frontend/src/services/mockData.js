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
    details: 'Emergency response server initialized in standalone simulation mode',
    ip_address: '127.0.0.1',
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
  }
];

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
    const users = mockDb.getUsers();
    
    // Find matching user or fallback to standard demo user
    let user = users.find(
      u => u.username.toLowerCase() === rawUsername || u.email.toLowerCase() === rawUsername
    );

    if (!user) {
      if (rawUsername.includes('admin')) {
        user = DEMO_USERS.admin;
      } else if (rawUsername.includes('viewer')) {
        user = DEMO_USERS.viewer;
      } else {
        user = DEMO_USERS.operator;
      }
    }

    const token = `ser-demo-jwt-${user.role.toLowerCase()}-${Date.now()}`;
    mockDb.addLog('LOGIN', 'User', `User ${user.username} authenticated in standalone mode`, user.username);

    return mockResponse({
      message: 'Login successful (Simulation Mode)',
      token,
      user,
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
        i.description?.toLowerCase().includes(q)
      );
    }

    return mockResponse({
      accidents: list,
      total: list.length,
      page: 1,
      per_page: 50,
    });
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
    const newInc = {
      id: Date.now(),
      incident_id: `INC-2026-${String(incidents.length + 1).padStart(3, '0')}`,
      date_time: new Date().toISOString(),
      created_at: new Date().toISOString(),
      latitude: body?.latitude || 40.7527,
      longitude: body?.longitude || -73.9818,
      address: body?.address || 'Reported Incident Location',
      description: body?.description || 'Emergency incident reported via terminal',
      severity: body?.severity || 'High',
      ai_confidence: body?.ai_confidence || 91.0,
      verification_status: body?.verification_status || 'Pending',
      response_status: 'Pending',
      assigned_unit_id: null,
      reporter: body?.reporter || 'Citizen / Camera Telemetry',
    };

    incidents.unshift(newInc);
    mockDb.saveIncidents(incidents);

    // Add alert notification
    const notifs = mockDb.getNotifications();
    notifs.unshift({
      id: Date.now(),
      title: `${newInc.severity.toUpperCase()}: ${newInc.incident_id} Reported`,
      message: `${newInc.address} - ${newInc.description.slice(0, 80)}...`,
      type: newInc.severity === 'Critical' ? 'Critical' : 'Warning',
      is_read: false,
      created_at: new Date().toISOString(),
    });
    mockDb.saveNotifications(notifs);
    mockDb.addLog('CREATE', 'Accident', `Created ticket ${newInc.incident_id}`);

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

  // -------------------------------------------------------------
  // REPORTS
  // -------------------------------------------------------------
  if (url.startsWith('/reports/')) {
    const analytics = mockDb.getAnalytics();
    return mockResponse({
      report_data: analytics,
      total_records: 34,
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
