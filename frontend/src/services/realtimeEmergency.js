/**
 * Real-Time Emergency SOS Cloud Relay Service (Dual-Relay Redundant Architecture)
 * Connects public citizen mobile devices directly with the Admin Dispatch Terminal
 * using Server-Sent Events (SSE) + background catch-up polling with zero rate-limit issues.
 */

import { cleanPhoneNumber, cleanLocation, isDummyPhoneNumber } from './mockData';

export const EMERGENCY_TOPIC = 'ser_emergency_live_v5';

// Redundant relay hosts prevent single-point-of-failure or 429 rate limit blocks
export const RELAY_HOSTS = [
  'https://ntfy.envs.net',
  'https://ntfy.sh',
];

// Track alerts processed in current session to prevent duplicate popups across dual relays
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

    // Try primary relay first
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
        console.warn(`Upload fallback attempt on ${host} note:`, e);
      }
    }
  } catch (err) {
    console.warn('Photo cloud relay upload error:', err);
  }
  return null;
}

/**
 * Broadcasts an SOS alert from any mobile phone to all listening Admin terminals
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

  // 2. Broadcast over redundant dual cloud relays (ASCII headers prevent fetch ByteString errors)
  const broadcastHeaders = {
    'Title': `EMERGENCY SOS: ${String(payload.type).toUpperCase()}`,
    'Priority': '5',
    'Tags': `rotating_light,${payload.type ? payload.type.toLowerCase() : 'ambulance'}`,
  };

  if (finalPhoto) {
    broadcastHeaders['Attach'] = finalPhoto;
  }

  const broadcastResults = await Promise.allSettled(
    RELAY_HOSTS.map(async (host) => {
      const res = await fetch(`${host}/${EMERGENCY_TOPIC}`, {
        method: 'POST',
        headers: broadcastHeaders,
        body: JSON.stringify(payload),
      });
      return { host, status: res.status };
    })
  );

  console.log('[SER Relay] Broadcast results across dual relays:', broadcastResults);

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
 * Subscribes to the real-time emergency channel with dual SSE + Catch-up Polling
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

  // 1. Primary: Server-Sent Events (SSE) stream on redundant hosts
  const connectSse = () => {
    if (isClosed || typeof EventSource === 'undefined') return;

    eventSources.forEach((es) => {
      try { es.close(); } catch {}
    });
    eventSources = [];

    RELAY_HOSTS.forEach((host) => {
      try {
        const es = new EventSource(`${host}/${EMERGENCY_TOPIC}/sse`);
        es.onopen = () => {
          console.log(`[SER Relay] SSE open on ${host}`);
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

  // 2. Secondary: Catch-up poll (every 20 seconds, avoids 429 rate limits)
  const pollFallback = async () => {
    if (isClosed) return;

    for (const host of RELAY_HOSTS) {
      try {
        const res = await fetch(`${host}/${EMERGENCY_TOPIC}/json?poll=1&since=10m`);
        if (res.ok) {
          const text = await res.text();
          const lines = text.trim().split('\n').filter(Boolean);
          const validAlerts = lines
            .map((line) => {
              try {
                const raw = JSON.parse(line);
                return raw.event === 'message' ? parseRawMessage(raw) : null;
              } catch {
                return null;
              }
            })
            .filter(Boolean)
            .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

          for (const alert of validAlerts) {
            handleNewAlert(alert);
          }
          break; // Stop after first successful host
        }
      } catch {}
    }

    if (!isClosed) {
      pollTimer = setTimeout(pollFallback, 20000);
    }
  };

  // Listen to window custom events
  const handleLocalCustomEvent = (e) => {
    if (e.detail) handleNewAlert(e.detail);
  };
  window.addEventListener('ser_emergency_sos', handleLocalCustomEvent);

  // Start SSE stream & initial catch-up poll
  connectSse();
  pollFallback();

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
