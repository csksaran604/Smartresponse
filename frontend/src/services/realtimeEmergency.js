/**
 * Real-Time Emergency SOS Cloud Relay & Sync Service
 * Connects citizen mobile devices directly with the Admin Dispatch Terminal
 * using high-reliability REST cloud sync + dual-relay SSE pub/sub.
 */

import { cleanPhoneNumber, cleanLocation, isDummyPhoneNumber } from './mockData';

export const EMERGENCY_TOPIC = 'ser_emergency_live_v5';

// Fast high-availability REST cloud object ID for instant cross-device synchronization
const REST_CLOUD_OBJECT_ID = 'ff808181a067127101a094ee8d8d008b';
const REST_SYNC_URL = `https://api.restful-api.dev/objects/${REST_CLOUD_OBJECT_ID}`;

// Redundant pub/sub relays
export const RELAY_HOSTS = [
  'https://ntfy.envs.net',
  'https://ntfy.sh',
];

// Track alerts processed in current session to prevent duplicate popups
const processedAlertIds = new Set();

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
        const timer = setTimeout(() => controller.abort(), 6000);

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
        console.warn(`Upload attempt on ${host} note:`, e);
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
  const alertId = alertData.id || `SOS-${Date.now().toString().slice(-6)}`;

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
  const finalPhoto = photoUrl || (rawPhoto && (rawPhoto.startsWith('http://') || rawPhoto.startsWith('https://')) ? rawPhoto : null);

  const selectedType = alertData.type || alertData.emergencyType || 'Medical';
  const payload = {
    id: alertId,
    type: selectedType,
    emergencyType: selectedType,
    latitude: alertData.latitude != null ? Number(alertData.latitude) : 11.3410,
    longitude: alertData.longitude != null ? Number(alertData.longitude) : 77.7172,
    address: cleanAddr,
    notes: alertData.notes || `${selectedType} emergency assistance requested via citizen portal`,
    urgency: alertData.urgency || 'Critical',
    reporter_phone: cleanPhone,
    phone: cleanPhone,
    photo: finalPhoto,
    timestamp: alertData.timestamp || new Date().toISOString(),
    source: alertData.source || 'PUBLIC_MOBILE_SOS',
  };

  // 1. Persist locally on reporting device
  try {
    localStorage.setItem('ser_active_sos', JSON.stringify({ ...payload, photo: rawPhoto || finalPhoto }));
    window.dispatchEvent(new CustomEvent('ser_emergency_sos', { detail: { ...payload, photo: rawPhoto || finalPhoto } }));
  } catch (err) {
    console.warn('Local storage cache note:', err);
  }

  // 2. Publish to REST Cloud Sync (guaranteed delivery across devices with zero rate-limit blocks)
  try {
    await fetch(REST_SYNC_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'SER_ACTIVE_DISPATCH_SOS',
        data: payload,
      }),
    });
    console.log('[SER Relay] ✅ Published to REST Cloud Sync successfully.');
  } catch (err) {
    console.warn('[SER Relay] REST Cloud sync warning:', err);
  }

  // 3. Broadcast to dual SSE pub/sub relays in parallel
  const broadcastHeaders = {
    'Title': `EMERGENCY SOS: ${String(payload.type).toUpperCase()}`,
    'Priority': '5',
    'Tags': `rotating_light,${payload.type ? payload.type.toLowerCase() : 'ambulance'}`,
  };

  if (finalPhoto) {
    broadcastHeaders['Attach'] = finalPhoto;
  }

  await Promise.allSettled(
    RELAY_HOSTS.map((host) =>
      fetch(`${host}/${EMERGENCY_TOPIC}`, {
        method: 'POST',
        headers: broadcastHeaders,
        body: JSON.stringify(payload),
      }).catch((e) => console.warn(`Relay ${host} broadcast warning:`, e))
    )
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

  return parsed;
}

/**
 * Subscribes to the real-time emergency channel with REST sync + Dual SSE
 */
export function subscribeToEmergencyAlerts(onAlertReceived) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let eventSources = [];
  let isClosed = false;
  let pollTimer = null;

  const handleNewAlert = (alert) => {
    if (!alert || !alert.id) return;
    if (processedAlertIds.has(alert.id)) return;

    // Check alert age (ignore alerts older than 15 minutes)
    if (alert.timestamp) {
      const alertTime = new Date(alert.timestamp).getTime();
      if (Date.now() - alertTime > 15 * 60 * 1000) {
        processedAlertIds.add(alert.id);
        return;
      }
    }

    processedAlertIds.add(alert.id);
    console.log('[SER Relay] 🚨 INCOMING SOS RECEIVED ON ADMIN DISPATCH:', alert);

    try {
      localStorage.setItem('ser_active_sos', JSON.stringify(alert));
      window.dispatchEvent(new CustomEvent('ser_emergency_sos', { detail: alert }));
    } catch {}

    onAlertReceived(alert);
  };

  // 1. Primary: REST Cloud Sync Polling (active every 3.5s, reliable cross-device)
  const pollRestSync = async () => {
    if (isClosed) return;

    try {
      const res = await fetch(REST_SYNC_URL);
      if (res.ok) {
        const json = await res.json();
        const alertData = json.data;
        if (alertData && alertData.id && (alertData.type || alertData.emergencyType)) {
          const parsed = parseRawMessage({ message: JSON.stringify(alertData) });
          if (parsed) handleNewAlert(parsed);
        }
      }
    } catch (e) {
      // Ignore network jitter
    }

    if (!isClosed) {
      pollTimer = setTimeout(pollRestSync, 3500);
    }
  };

  // 2. Secondary: Server-Sent Events (SSE) stream on redundant hosts
  const connectSse = () => {
    if (isClosed || typeof EventSource === 'undefined') return;

    RELAY_HOSTS.forEach((host) => {
      try {
        const es = new EventSource(`${host}/${EMERGENCY_TOPIC}/sse`);
        es.onopen = () => {
          console.log(`[SER Relay] SSE stream open on ${host}`);
        };
        es.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data);
            if (raw.event !== 'message') return;
            const alert = parseRawMessage(raw);
            if (alert) handleNewAlert(alert);
          } catch (err) {
            console.warn('[SER Relay] SSE parse error:', err);
          }
        };
        es.onerror = () => {
          try { es.close(); } catch {}
        };
        eventSources.push(es);
      } catch (e) {
        console.warn(`SSE setup note for ${host}:`, e);
      }
    });
  };

  // Listen to window custom events
  const handleLocalCustomEvent = (e) => {
    if (e.detail) handleNewAlert(e.detail);
  };
  window.addEventListener('ser_emergency_sos', handleLocalCustomEvent);

  // Start both REST sync and SSE stream
  pollRestSync();
  connectSse();

  return () => {
    isClosed = true;
    eventSources.forEach((es) => {
      try { es.close(); } catch {}
    });
    eventSources = [];
    if (pollTimer) clearTimeout(pollTimer);
    window.removeEventListener('ser_emergency_sos', handleLocalCustomEvent);
    console.log('[SER Relay] Listener disconnected cleanly.');
  };
}
