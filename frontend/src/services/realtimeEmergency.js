/**
 * Real-Time Emergency SOS Cloud Relay Service
 * Connects public citizen mobile devices directly with the Operator Dispatch Terminal
 * using Server-Sent Events (SSE) + active background polling fallback via ntfy.sh.
 */

const EMERGENCY_TOPIC = 'ser_smartresponse_emergency_alerts_v1';
const PUBLISH_URL = `https://ntfy.sh/${EMERGENCY_TOPIC}`;
const SUBSCRIBE_URL = `https://ntfy.sh/${EMERGENCY_TOPIC}/sse`;
const POLL_URL = `https://ntfy.sh/${EMERGENCY_TOPIC}/json?poll=1&since=60s`;

// Track alerts processed in current session to prevent duplicate popups
const processedAlertIds = new Set();

/**
 * Uploads citizen captured photo to cloud relay file hosting
 * and returns direct public image URL
 */
async function uploadPhotoToCloud(photo) {
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

    const res = await fetch(`https://ntfy.sh/${EMERGENCY_TOPIC}_uploads`, {
      method: 'PUT',
      headers: {
        Filename: `sos_${Date.now()}.jpg`,
        Title: 'Citizen SOS Accident Photo',
      },
      body: blob,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.attachment?.url) {
        return data.attachment.url;
      }
    }
  } catch (err) {
    console.warn('Photo cloud relay upload error:', err);
  }
  return null;
}

/**
 * Broadcasts an SOS alert from any mobile phone or computer to all listening operators
 */
export async function broadcastEmergencySos(alertData) {
  // Always cache local photo immediately in current browser
  const rawPhoto = alertData.photo || alertData.photo_url || null;
  const alertId = alertData.id || `SOS-${Date.now().toString().slice(-6)}`;

  if (rawPhoto) {
    try {
      localStorage.setItem(`ser_sos_photo_${alertId}`, rawPhoto);
      localStorage.setItem('ser_latest_sos_photo', rawPhoto);
    } catch (e) {
      console.warn('Could not cache photo locally:', e);
    }
  }

  // Upload photo to cloud file relay to get a small URL that fits ntfy 4KB payload limit
  let photoUrl = null;
  if (rawPhoto) {
    try {
      photoUrl = await uploadPhotoToCloud(rawPhoto);
    } catch {}
  }

  const payload = {
    id: alertId,
    type: alertData.emergencyType || alertData.type || 'Medical',
    latitude: alertData.latitude != null ? Number(alertData.latitude) : 13.0827,
    longitude: alertData.longitude != null ? Number(alertData.longitude) : 80.2707,
    address: alertData.address || `Live Citizen GPS Location`,
    notes: alertData.notes || 'Emergency assistance requested via citizen mobile portal',
    urgency: alertData.urgency || 'Critical',
    reporter_phone: alertData.phone || alertData.reporter_phone || 'Citizen Mobile Caller',
    photo: photoUrl || (rawPhoto && rawPhoto.length < 2000 ? rawPhoto : null),
    timestamp: new Date().toISOString(),
    source: alertData.source || 'PUBLIC_MOBILE_SOS',
  };

  // Remember our own sent alert so we don't alarm ourselves on the same phone
  processedAlertIds.add(payload.id);

  try {
    // Send lightweight JSON payload over ntfy cloud relay
    const res = await fetch(PUBLISH_URL, {
      method: 'POST',
      headers: {
        'Title': `🚨 EMERGENCY SOS: ${payload.type.toUpperCase()}`,
        'Priority': '5',
        'Tags': 'rotating_light,warning,ambulance',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn('Realtime SOS broadcast non-200 response:', res.status);
    }

    // Also persist in local storage as current active SOS
    try {
      localStorage.setItem('ser_active_sos', JSON.stringify({ ...payload, photo: rawPhoto || photoUrl }));
      window.dispatchEvent(new CustomEvent('ser_emergency_sos', { detail: { ...payload, photo: rawPhoto || photoUrl } }));
    } catch {}

    return { success: true, payload };
  } catch (err) {
    console.error('Failed to broadcast SOS over cloud relay:', err);
    return { success: false, payload, error: err.message };
  }
}

/**
 * Parses raw SSE / poll message into a structured SOS payload
 */
function parseRawMessage(raw) {
  if (!raw) return null;

  let parsed = null;

  // Case 1: raw.message is a JSON string containing our complete payload
  if (typeof raw.message === 'string') {
    try {
      parsed = JSON.parse(raw.message);
    } catch {
      // Plain text message fallback
    }
  }

  // Case 2: raw is already the payload
  if (!parsed && raw.latitude && raw.longitude) {
    parsed = raw;
  }

  // Case 3: Reconstruct from text message
  if (!parsed) {
    parsed = {
      id: raw.id || `SOS-${Date.now().toString().slice(-6)}`,
      type: (raw.title || raw.message || '').includes('POLICE') ? 'Police' : (raw.title || raw.message || '').includes('FIRE') ? 'Fire' : 'Medical',
      latitude: 13.0827,
      longitude: 80.2707,
      address: raw.message || 'Live Citizen GPS Location',
      notes: raw.message || '',
      urgency: 'Critical',
      reporter_phone: 'Citizen Mobile Caller',
      timestamp: raw.time ? new Date(raw.time * 1000).toISOString() : new Date().toISOString(),
    };
  }

  // Case 4: If ntfy delivered an attachment URL
  if (raw.attachment?.url) {
    parsed.photo = parsed.photo || raw.attachment.url;
  }

  // Case 5: Attach cached photo if available in current browser session
  if (parsed && !parsed.photo) {
    try {
      const cached = localStorage.getItem(`ser_sos_photo_${parsed.id}`) || localStorage.getItem('ser_latest_sos_photo');
      if (cached) {
        parsed.photo = cached;
      }
    } catch {}
  }

  return parsed;
}

/**
 * Subscribes to the real-time emergency channel with dual SSE + Polling Fallback
 */
export function subscribeToEmergencyAlerts(onAlertReceived) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let eventSource = null;
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
    console.log('[SER Relay] 🚨 NEW INCOMING SOS ALERT:', alert);

    try {
      localStorage.setItem('ser_active_sos', JSON.stringify(alert));
      window.dispatchEvent(new CustomEvent('ser_emergency_sos', { detail: alert }));
    } catch {}

    onAlertReceived(alert);
  };

  // 1. Primary: Server-Sent Events (SSE) connection
  const connectSse = () => {
    if (isClosed || typeof EventSource === 'undefined') return;

    try {
      eventSource = new EventSource(SUBSCRIBE_URL);

      eventSource.onopen = () => {
        console.log('[SER Relay] Active SSE connection open on emergency channel.');
      };

      eventSource.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          if (raw.event !== 'message') return;

          const alert = parseRawMessage(raw);
          if (alert) handleNewAlert(alert);
        } catch (err) {
          console.warn('[SER Relay] SSE parse error:', err);
        }
      };

      eventSource.onerror = () => {
        if (eventSource) eventSource.close();
        if (!isClosed) {
          setTimeout(connectSse, 5000);
        }
      };
    } catch (e) {
      console.warn('[SER Relay] SSE setup error:', e);
    }
  };

  // 2. Secondary: Active background polling fallback (every 4 seconds)
  // Ensures alerts are never missed even if the browser sleeps or disconnects SSE
  const pollFallback = async () => {
    if (isClosed) return;

    try {
      const res = await fetch(POLL_URL);
      if (res.ok) {
        const text = await res.text();
        const lines = text.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const raw = JSON.parse(line);
            if (raw.event === 'message') {
              const alert = parseRawMessage(raw);
              if (alert) handleNewAlert(alert);
            }
          } catch {}
        }
      }
    } catch (_e) {
      // Ignore network hiccups on poll
    }

    if (!isClosed) {
      pollTimer = setTimeout(pollFallback, 4000);
    }
  };

  // Listen to window custom event if triggered in same tab or child window
  const handleLocalCustomEvent = (e) => {
    if (e.detail) handleNewAlert(e.detail);
  };
  window.addEventListener('ser_emergency_sos', handleLocalCustomEvent);

  // Check if there is an unprocessed active SOS stored recently
  try {
    const saved = localStorage.getItem('ser_active_sos');
    if (saved) {
      const parsedSaved = JSON.parse(saved);
      if (parsedSaved && parsedSaved.timestamp) {
        if (Date.now() - new Date(parsedSaved.timestamp).getTime() < 3 * 60 * 1000) {
          handleNewAlert(parsedSaved);
        }
      }
    }
  } catch {}

  // Start both SSE and Polling
  connectSse();
  pollFallback();

  return () => {
    isClosed = true;
    if (eventSource) eventSource.close();
    if (pollTimer) clearTimeout(pollTimer);
    window.removeEventListener('ser_emergency_sos', handleLocalCustomEvent);
    console.log('[SER Relay] Cleaned up emergency alert listener.');
  };
}
