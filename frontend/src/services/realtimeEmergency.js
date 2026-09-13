/**
 * Real-Time Emergency SOS Cloud Relay & Sync Service
 * Connects citizen mobile devices directly with the Admin Dispatch Terminal
 * using high-reliability REST cloud sync + dual-relay SSE pub/sub + BroadcastChannel.
 */

import { cleanPhoneNumber, cleanLocation, isDummyPhoneNumber } from './mockData';

export const EMERGENCY_TOPIC = 'ser_emergency_live_v5';

// Fast high-availability REST cloud object ID for instant cross-device synchronization
const REST_CLOUD_OBJECT_ID = 'ff808181a067127101a094ee8d8d008b';
const REST_SYNC_URL = `https://api.restful-api.dev/objects/${REST_CLOUD_OBJECT_ID}`;

// Redundant pub/sub relays (prioritizing responsive host)
export const RELAY_HOSTS = [
  'https://ntfy.sh',
  'https://ntfy.envs.net',
];

// BroadcastChannel for instant zero-latency cross-tab synchronization in the same browser
const BROADCAST_CHANNEL_NAME = 'ser_emergency_channel';
let sharedBroadcastChannel = null;
try {
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    sharedBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch (e) {
  console.warn('[SER Relay] BroadcastChannel not supported:', e);
}

// Track alerts processed in current session to prevent duplicate popups
const processedAlertIds = new Set();

// Centralized registry of alert subscribers
const alertSubscribers = new Set();
let globalPollTimer = null;
let globalEventSources = [];
let isServiceRunning = false;

/**
 * Check if alert was already dismissed or handled by admin
 */
export function isAlertDismissed(id) {
  if (!id || typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('ser_dismissed_alerts');
    if (!raw) return false;
    const dismissed = JSON.parse(raw);
    if (!Array.isArray(dismissed)) return false;
    const strId = String(id).trim();
    if (!strId) return false;
    return dismissed.some((d) => d != null && String(d).trim() === strId);
  } catch {
    return false;
  }
}

/**
 * Mark an alert as dismissed so it doesn't pop up again
 */
export function markAlertDismissed(id) {
  if (!id || typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('ser_dismissed_alerts');
    const dismissed = raw ? JSON.parse(raw) : [];
    const strId = String(id).trim();
    if (Array.isArray(dismissed) && !dismissed.includes(strId)) {
      dismissed.push(strId);
      localStorage.setItem('ser_dismissed_alerts', JSON.stringify(dismissed.slice(-100)));
    }
    const active = localStorage.getItem('ser_active_sos');
    if (active) {
      const parsed = JSON.parse(active);
      if (parsed?.id && String(parsed.id).trim() === strId) {
        localStorage.removeItem('ser_active_sos');
      }
    }
  } catch {}
}

/**
 * Checks cloud relays & REST object for the latest undismissed emergency message
 */
export async function checkPendingCloudAlert() {
  // 1. Check REST Cloud Object (fastest & most reliable cross-device sync)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(REST_SYNC_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      const alert = parseRawMessage(json?.data || json);
      if (alert && alert.id && !isAlertDismissed(alert.id)) {
        const timeStr = alert.timestamp || alert.created_at || '';
        const ageMs = timeStr ? Date.now() - new Date(timeStr).getTime() : 0;
        if (isNaN(ageMs) || ageMs < 4 * 60 * 60 * 1000) {
          return alert;
        }
      }
    }
  } catch {}

  // 2. Check Pub/Sub Relays
  for (const host of RELAY_HOSTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${host}/${EMERGENCY_TOPIC}/json?poll=1&since=30m`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const text = await res.text();
        const lines = text.trim().split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const raw = JSON.parse(lines[i]);
            if (raw.event !== 'message') continue;
            const alert = parseRawMessage(raw);
            if (alert && alert.id && !isAlertDismissed(alert.id)) {
              return alert;
            }
          } catch {}
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Uploads citizen captured photo to cloud relay file hosting
 * and returns direct public image URL
 */
export async function uploadPhotoToCloud(photo) {
  if (!photo) return null;
  if (typeof photo === 'string' && (photo.startsWith('http://') || photo.startsWith('https://'))) {
    return photo;
  }
  try {
    let blob = null;
    if (typeof photo === 'string' && photo.startsWith('data:')) {
      const parts = photo.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blob = new Blob([u8arr], { type: mime });
    } else if (photo instanceof Blob) {
      blob = photo;
    }

    if (!blob) return null;

    // Try redundant cloud relays
    for (const host of RELAY_HOSTS) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`${host}/${EMERGENCY_TOPIC}_uploads`, {
          method: 'PUT',
          headers: {
            Filename: `sos_${Date.now()}.jpg`,
            Title: 'Citizen SOS Accident Photo',
          },
          body: blob,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          if (data.attachment?.url) {
            return data.attachment.url;
          }
        }
      } catch (e) {
        // Continue to fallback
      }
    }
  } catch (err) {
    console.warn('Photo cloud relay upload error:', err);
  }
  return null;
}

/**
 * Broadcasts an SOS alert from mobile phone to all listening Admin terminals
 */
export async function broadcastEmergencySos(alertData) {
  const rawPhoto = alertData.photo || alertData.photo_url || null;
  const alertId = alertData.id || `SOS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Cache photo locally on reporting device
  if (rawPhoto) {
    try {
      localStorage.setItem(`ser_sos_photo_${alertId}`, rawPhoto);
      localStorage.setItem('ser_latest_sos_photo', rawPhoto);
      localStorage.setItem('ser_user_uploaded_photo', rawPhoto);
    } catch (e) {
      console.warn('Could not cache photo locally:', e);
    }
  }

  // Upload photo to cloud file relay to get a small public URL
  let photoUrl = null;
  if (rawPhoto) {
    try {
      photoUrl = await uploadPhotoToCloud(rawPhoto);
    } catch {}
  }

  const storedPhone = typeof window !== 'undefined' ? (localStorage.getItem('ser_user_phone') || '') : '';
  const rawUserPhone = (!isDummyPhoneNumber(alertData.phone) ? alertData.phone : '') ||
                       (!isDummyPhoneNumber(alertData.reporter_phone) ? alertData.reporter_phone : '') ||
                       (!isDummyPhoneNumber(storedPhone) ? storedPhone : '') || '';

  if (rawUserPhone && !isDummyPhoneNumber(rawUserPhone) && typeof window !== 'undefined') {
    try {
      localStorage.setItem('ser_user_phone', rawUserPhone);
    } catch {}
  }
  const cleanPhone = rawUserPhone || cleanPhoneNumber('', alertId);
  const cleanAddr = cleanLocation(alertData.address);
  const finalPhoto = photoUrl || (typeof rawPhoto === 'string' && rawPhoto.length > 0 ? rawPhoto : null);

  const selectedType = alertData.type || alertData.emergencyType || 'Medical';
  const payload = {
    id: alertId,
    type: selectedType,
    emergencyType: selectedType,
    latitude: alertData.latitude != null ? Number(alertData.latitude) : 11.3410,
    longitude: alertData.longitude != null ? Number(alertData.longitude) : 77.7172,
    address: cleanAddr,
    notes: alertData.notes || alertData.description || `${selectedType} emergency assistance requested via citizen portal`,
    urgency: alertData.urgency || 'Critical',
    reporter_phone: cleanPhone,
    phone: cleanPhone,
    photo: finalPhoto,
    timestamp: alertData.timestamp || new Date().toISOString(),
    source: alertData.source || 'PUBLIC_MOBILE_SOS',
  };

  // 1. Instant Local Persistence & Cross-Tab Broadcast (Zero-latency)
  try {
    localStorage.setItem('ser_active_sos', JSON.stringify(payload));
    if (finalPhoto) {
      localStorage.setItem(`ser_sos_photo_${alertId}`, finalPhoto);
      localStorage.setItem('ser_latest_sos_photo', finalPhoto);
      localStorage.setItem('ser_user_uploaded_photo', finalPhoto);
    }
    window.dispatchEvent(new CustomEvent('ser_emergency_sos', { detail: payload }));
    if (sharedBroadcastChannel) {
      sharedBroadcastChannel.postMessage({ type: 'SER_EMERGENCY_SOS', payload });
    }
  } catch (err) {
    console.warn('Local storage cache note:', err);
  }

  // 2. High-Speed Cloud REST Object Sync (Cross-Device)
  const cloudPayload = {
    ...payload,
    photo: photoUrl || (typeof finalPhoto === 'string' && finalPhoto.startsWith('http') ? finalPhoto : null),
  };

  try {
    const restController = new AbortController();
    const restTimer = setTimeout(() => restController.abort(), 4000);
    fetch(REST_SYNC_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'SER_ACTIVE_DISPATCH_SOS',
        data: cloudPayload,
      }),
      signal: restController.signal,
    })
      .then(() => clearTimeout(restTimer))
      .catch((e) => {
        clearTimeout(restTimer);
        console.warn('REST sync notice:', e);
      });
  } catch {}

  // 3. Redundant SSE pub/sub relays (for real-time streaming & offline admins)
  const broadcastHeaders = {
    'Title': `EMERGENCY SOS: ${String(payload.type).toUpperCase()}`,
    'Priority': '5',
    'Tags': `rotating_light,${payload.type ? payload.type.toLowerCase() : 'ambulance'}`,
  };
  if (photoUrl) {
    broadcastHeaders['Attach'] = photoUrl;
  }

  await Promise.allSettled(
    RELAY_HOSTS.map(async (host) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        await fetch(`${host}/${EMERGENCY_TOPIC}`, {
          method: 'POST',
          headers: broadcastHeaders,
          body: JSON.stringify(cloudPayload),
          signal: controller.signal,
        });
        clearTimeout(timer);
      } catch (e) {
        console.warn(`Relay ${host} broadcast warning:`, e);
      }
    })
  );

  return { success: true, payload };
}

/**
 * Parses raw SSE / poll message into a structured SOS payload
 */
export function parseRawMessage(raw) {
  if (!raw) return null;

  let parsed = null;

  // Case 1: raw.message is a JSON string containing our complete payload
  if (typeof raw.message === 'string') {
    try {
      const obj = JSON.parse(raw.message);
      if (obj && (obj.id || obj.type || obj.emergencyType || obj.latitude != null)) {
        parsed = obj;
      }
    } catch {}
  }

  // Case 2: raw is already the payload
  if (!parsed && raw.latitude != null && raw.longitude != null) {
    parsed = { ...raw };
  }

  // Case 3: Reconstruct from text message with emergency keywords
  if (!parsed) {
    const text = (raw.title || '') + ' ' + (raw.message || '');
    if (/emergency|distress|accident|crash|fire|police|medical|ambulance/i.test(text)) {
      const detectedType = /traffic|crash|collision/i.test(text) ? 'Traffic' :
                           /police|crime/i.test(text) ? 'Police' :
                           /fire/i.test(text) ? 'Fire' : 'Medical';
      parsed = {
        id: raw.id || `SOS-${Date.now().toString().slice(-6)}`,
        type: detectedType,
        emergencyType: detectedType,
        latitude: 11.3410,
        longitude: 77.7172,
        address: cleanLocation(raw.message || 'Perundurai Road, Erode, Tamil Nadu'),
        notes: raw.message || '',
        urgency: 'Critical',
        reporter_phone: cleanPhoneNumber('', raw.id),
        phone: cleanPhoneNumber('', raw.id),
        timestamp: raw.time ? new Date(raw.time * 1000).toISOString() : new Date().toISOString(),
        source: 'PUBLIC_MOBILE_SOS',
      };
    }
  }

  if (!parsed) return null;

  // Attach attachment URL if delivered
  if (raw.attachment?.url) {
    parsed.photo = parsed.photo || raw.attachment.url;
  }

  // Enforce consistent property names
  const alertType = parsed.emergencyType || parsed.type || 'Medical';
  parsed.type = alertType;
  parsed.emergencyType = alertType;
  parsed.address = cleanLocation(parsed.address);
  const cleanPhone = (!isDummyPhoneNumber(parsed.phone) ? parsed.phone : '') ||
                     (!isDummyPhoneNumber(parsed.reporter_phone) ? parsed.reporter_phone : '');
  parsed.phone = cleanPhone || parsed.phone || cleanPhoneNumber('', parsed.id);
  parsed.reporter_phone = parsed.phone;
  parsed.source = parsed.source || 'PUBLIC_MOBILE_SOS';

  return parsed;
}

/**
 * Dispatch an alert to all active subscribers across the app
 */
function dispatchToAllSubscribers(alert) {
  if (!alert || !alert.id) return;
  if (isAlertDismissed(alert.id)) return;

  console.log('[SER Relay] 🚨 INCOMING SOS DISPATCHED TO ALL LISTENERS:', alert.id, alert);

  try {
    localStorage.setItem('ser_active_sos', JSON.stringify(alert));
    window.dispatchEvent(new CustomEvent('ser_emergency_sos', { detail: alert }));
  } catch {}

  alertSubscribers.forEach((cb) => {
    try {
      cb(alert);
    } catch (err) {
      console.warn('[SER Relay] Subscriber callback error:', err);
    }
  });
}

/**
 * Starts the global polling and SSE listeners (runs once, feeds all subscribers)
 */
function startGlobalRelayService() {
  if (isServiceRunning || typeof window === 'undefined') return;
  isServiceRunning = true;

  // 1. Polling Routine: Checks REST Cloud Object & Relays
  const pollCloud = async () => {
    if (!isServiceRunning) return;

    try {
      const alert = await checkPendingCloudAlert();
      if (alert && alert.id && !isAlertDismissed(alert.id) && !processedAlertIds.has(alert.id)) {
        processedAlertIds.add(alert.id);
        dispatchToAllSubscribers(alert);
      }
    } catch {}

    if (isServiceRunning) {
      globalPollTimer = setTimeout(pollCloud, 3500);
    }
  };

  // 2. Server-Sent Events (SSE) Stream
  const connectSse = () => {
    if (!isServiceRunning || typeof EventSource === 'undefined') return;

    RELAY_HOSTS.forEach((host) => {
      try {
        const es = new EventSource(`${host}/${EMERGENCY_TOPIC}/sse?since=20m`);
        es.onopen = () => {
          console.log(`[SER Relay] SSE stream connected on ${host}`);
        };
        es.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data);
            if (raw.event !== 'message') return;
            const alert = parseRawMessage(raw);
            if (alert && alert.id && !isAlertDismissed(alert.id) && !processedAlertIds.has(alert.id)) {
              processedAlertIds.add(alert.id);
              dispatchToAllSubscribers(alert);
            }
          } catch (err) {
            console.warn('[SER Relay] SSE parse note:', err);
          }
        };
        es.onerror = () => {
          try { es.close(); } catch {}
        };
        globalEventSources.push(es);
      } catch (e) {
        console.warn(`[SER Relay] SSE init note for ${host}:`, e);
      }
    });
  };

  // 3. Listen to local window events
  const handleLocalCustomEvent = (e) => {
    if (e.detail && !isAlertDismissed(e.detail.id) && !processedAlertIds.has(e.detail.id)) {
      processedAlertIds.add(e.detail.id);
      dispatchToAllSubscribers(e.detail);
    }
  };
  window.addEventListener('ser_emergency_sos', handleLocalCustomEvent);

  // 4. Listen to storage changes from other tabs
  const handleStorageChange = (e) => {
    if (e.key === 'ser_active_sos' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && parsed.id && !isAlertDismissed(parsed.id) && !processedAlertIds.has(parsed.id)) {
          processedAlertIds.add(parsed.id);
          dispatchToAllSubscribers(parsed);
        }
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorageChange);

  // 5. Listen to BroadcastChannel messages
  if (sharedBroadcastChannel) {
    sharedBroadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'SER_EMERGENCY_SOS' && event.data?.payload) {
        const alert = event.data.payload;
        if (alert && alert.id && !isAlertDismissed(alert.id) && !processedAlertIds.has(alert.id)) {
          processedAlertIds.add(alert.id);
          dispatchToAllSubscribers(alert);
        }
      }
    };
  }

  // Kick off poll & SSE
  pollCloud();
  connectSse();
}

/**
 * Subscribes to the real-time emergency channel
 * Works across all components (Modal, AlertsPage, Dashboard, LiveMap) without blocking each other.
 */
export function subscribeToEmergencyAlerts(onAlertReceived) {
  if (typeof window === 'undefined' || typeof onAlertReceived !== 'function') {
    return () => {};
  }

  alertSubscribers.add(onAlertReceived);
  startGlobalRelayService();

  // Return unsubscribe function
  return () => {
    alertSubscribers.delete(onAlertReceived);
  };
}
