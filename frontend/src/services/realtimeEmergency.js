/**
 * Real-Time Emergency SOS Cloud Relay & Sync Service
 * Connects citizen mobile devices directly with the Admin Dispatch Terminal
 * using high-reliability dual-relay SSE pub/sub + BroadcastChannel + Rapid Polling.
 */

import { cleanPhoneNumber, cleanLocation, isDummyPhoneNumber } from './mockData';

export const EMERGENCY_TOPIC = 'ser_emergency_live_v5';

// Primary high-speed pub/sub broker
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
 * Checks cloud relays for the latest undismissed emergency message
 */
export async function checkPendingCloudAlert() {
  for (const host of RELAY_HOSTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      // Query recent cached messages without clock-skew-prone since parameter
      const res = await fetch(`${host}/${EMERGENCY_TOPIC}/json?poll=1`, {
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
 * Convert base64 dataUrl to binary Blob
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl) return null;
  if (dataUrl instanceof Blob) return dataUrl;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  try {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    return null;
  }
}

/**
 * Uploads citizen captured photo in background to avoid blocking the emergency dispatch
 */
export async function uploadPhotoToCloud(photo) {
  if (!photo) return null;
  if (typeof photo === 'string' && (photo.startsWith('http://') || photo.startsWith('https://'))) {
    return photo;
  }
  try {
    const blob = dataUrlToBlob(photo);
    if (!blob) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://ntfy.sh/${EMERGENCY_TOPIC}`, {
      method: 'PUT',
      headers: {
        'Title': 'Citizen Accident Photo Evidence',
        'X-Filename': `sos_${Date.now()}.jpg`,
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
  } catch (err) {}
  return null;
}

/**
 * Broadcasts an SOS alert immediately to all listening Admin terminals
 */
export async function broadcastEmergencySos(alertData) {
  const rawPhoto = alertData.photo || alertData.photo_url || null;
  const rawThumb = alertData.thumbnail || null;
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

  // If photo is already an HTTP URL or small, use it
  const photoUrl = typeof rawPhoto === 'string' && (rawPhoto.startsWith('http://') || rawPhoto.startsWith('https://')) ? rawPhoto : null;
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
    thumbnail: rawThumb || (typeof rawPhoto === 'string' && rawPhoto.length < 3000 ? rawPhoto : null),
    timestamp: alertData.timestamp || new Date().toISOString(),
    source: alertData.source || 'PUBLIC_MOBILE_SOS',
  };

  // 1. INSTANT DISPATCH: Local Storage, Custom Event & BroadcastChannel (0ms delay)
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

  // 2. Prepare Cloud Payload with micro-thumbnail so photo is NEVER NULL on remote terminals
  const cloudPayload = {
    id: payload.id,
    type: payload.type,
    emergencyType: payload.emergencyType,
    latitude: payload.latitude,
    longitude: payload.longitude,
    address: payload.address,
    notes: payload.notes,
    urgency: payload.urgency,
    reporter_phone: payload.reporter_phone,
    phone: payload.phone,
    photo: photoUrl || payload.thumbnail || null,
    thumbnail: payload.thumbnail || null,
    timestamp: payload.timestamp,
    source: payload.source,
  };

  const broadcastHeaders = {
    'Title': `EMERGENCY SOS: ${String(payload.type).toUpperCase()}`,
    'Priority': '5',
    'Tags': `rotating_light,${payload.type ? payload.type.toLowerCase() : 'ambulance'}`,
  };
  if (photoUrl) {
    broadcastHeaders['Attach'] = photoUrl;
  }

  // Binary photo blob for direct ntfy attachment upload
  const photoBlob = dataUrlToBlob(rawPhoto);

  // 3. INSTANT CLOUD BROADCAST
  (async () => {
    // If citizen captured a photo, upload it as a direct message attachment to ntfy.sh
    if (photoBlob) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://ntfy.sh/${EMERGENCY_TOPIC}`, {
          method: 'PUT',
          headers: {
            'Title': `EMERGENCY SOS: ${String(payload.type).toUpperCase()}`,
            'Priority': '5',
            'Tags': `rotating_light,${payload.type ? payload.type.toLowerCase() : 'ambulance'}`,
            'X-Message': JSON.stringify(cloudPayload),
            'X-Filename': `sos_${alertId}.jpg`,
          },
          body: photoBlob,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          console.log('[SER Relay] 🚀 Live SOS + Photo Attachment delivered to ntfy.sh');
          return;
        }
      } catch (e) {
        console.warn('[SER Relay] Direct PUT attachment note, falling back to JSON POST:', e);
      }
    }

    // Default or Fallback: JSON POST directly to ntfy.sh
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      await fetch(`https://ntfy.sh/${EMERGENCY_TOPIC}`, {
        method: 'POST',
        headers: broadcastHeaders,
        body: JSON.stringify(cloudPayload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      console.log('[SER Relay] 🚀 Live SOS delivered to ntfy.sh');
    } catch (e) {
      console.warn('[SER Relay] Primary ntfy.sh publish note:', e);
    }
  })();

  // Secondary fallback relay in background
  (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      await fetch(`https://ntfy.envs.net/${EMERGENCY_TOPIC}`, {
        method: 'POST',
        headers: broadcastHeaders,
        body: JSON.stringify(cloudPayload),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (e) {}
  })();

  // Background upload fallback if photo was not already an HTTP url
  if (rawPhoto && !photoUrl) {
    uploadPhotoToCloud(rawPhoto).then((uploadedUrl) => {
      if (uploadedUrl) {
        fetch(`https://ntfy.sh/${EMERGENCY_TOPIC}`, {
          method: 'POST',
          headers: { ...broadcastHeaders, 'Attach': uploadedUrl },
          body: JSON.stringify({ ...cloudPayload, photo: uploadedUrl, photo_url: uploadedUrl }),
        }).catch(() => {});
      }
    });
  }

  return payload;
}

/**
 * Normalizes incoming raw alert message from any source (SSE, Webhook, Poll, Local)
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

  // Attach attachment URL if delivered from ntfy server
  if (raw.attachment?.url) {
    parsed.photo = raw.attachment.url;
    parsed.photo_url = raw.attachment.url;
  } else if (parsed.thumbnail) {
    parsed.photo = parsed.photo || parsed.thumbnail;
    parsed.photo_url = parsed.photo_url || parsed.thumbnail;
  } else if (parsed.photo) {
    parsed.photo_url = parsed.photo;
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

  // 1. Rapid Polling Routine: Checks ntfy.sh every 1.0 second
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
      globalPollTimer = setTimeout(pollCloud, 1000);
    }
  };

  // 2. Server-Sent Events (SSE) Stream for instant 50ms push
  const connectSse = () => {
    if (!isServiceRunning || typeof EventSource === 'undefined') return;

    // Connect to primary ntfy.sh SSE stream
    try {
      const es = new EventSource(`https://ntfy.sh/${EMERGENCY_TOPIC}/sse`);
      es.onopen = () => {
        console.log('[SER Relay] ⚡ Real-time SSE stream connected on ntfy.sh');
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
        // Reconnect after 1 second
        if (isServiceRunning) {
          setTimeout(connectSse, 1000);
        }
      };
      globalEventSources.push(es);
    } catch (e) {
      console.warn('[SER Relay] SSE init note:', e);
    }
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

  // Kick off rapid poll & real-time SSE stream
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
