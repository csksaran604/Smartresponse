/**
 * Real-Time Emergency SOS Cloud Relay Service
 * Connects public citizen mobile devices directly with the Operator Dispatch Terminal
 * using high-availability Server-Sent Events (SSE) via ntfy.sh (100% free, zero-config).
 */

const EMERGENCY_TOPIC = 'ser_smartresponse_emergency_alerts_v1';
const PUBLISH_URL = `https://ntfy.sh/${EMERGENCY_TOPIC}`;
const SUBSCRIBE_URL = `https://ntfy.sh/${EMERGENCY_TOPIC}/sse`;

/**
 * Broadcasts an SOS alert from any mobile phone or computer to all listening operators
 */
export async function broadcastEmergencySos(alertData) {
  const payload = {
    id: alertData.id || `SOS-${Date.now().toString().slice(-6)}`,
    type: alertData.emergencyType || 'Medical',
    latitude: alertData.latitude,
    longitude: alertData.longitude,
    address: alertData.address || `GPS: ${alertData.latitude?.toFixed(5)}, ${alertData.longitude?.toFixed(5)}`,
    notes: alertData.notes || '',
    urgency: alertData.urgency || 'Critical',
    reporter_phone: alertData.phone || 'Citizen SOS',
    timestamp: new Date().toISOString(),
    source: 'PUBLIC_MOBILE_SOS',
  };

  const messageText = `🚨 [${payload.type.toUpperCase()} SOS] Location: ${payload.address}. Contact: ${payload.reporter_phone}. Notes: ${payload.notes || 'Immediate assistance requested'}`;

  try {
    const res = await fetch(PUBLISH_URL, {
      method: 'POST',
      headers: {
        'Title': `🚨 EMERGENCY SOS: ${payload.type.toUpperCase()}`,
        'Priority': '5',
        'Tags': 'rotating_light,warning,ambulance',
        'X-Emergency-Payload': JSON.stringify(payload),
      },
      body: messageText,
    });

    if (!res.ok) {
      console.warn('Realtime SOS broadcast non-200 response:', res.status);
    }
    return { success: true, payload };
  } catch (err) {
    console.error('Failed to broadcast SOS over cloud relay:', err);
    // Return payload even if cloud network has hiccup
    return { success: false, payload, error: err.message };
  }
}

/**
 * Subscribes to the real-time emergency channel (used on Operator terminal)
 */
export function subscribeToEmergencyAlerts(onAlertReceived) {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  let eventSource = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;

    try {
      eventSource = new EventSource(SUBSCRIBE_URL);

      eventSource.onopen = () => {
        console.log('[SER Relay] Connected to real-time emergency dispatch channel.');
      };

      eventSource.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          
          // Only handle standard message events
          if (raw.event !== 'message') return;

          let parsedPayload = null;
          
          // Try to extract payload from custom header or message body
          if (raw.headers && raw.headers['x-emergency-payload']) {
            try {
              parsedPayload = JSON.parse(raw.headers['x-emergency-payload']);
            } catch {}
          }

          if (!parsedPayload) {
            // Reconstruct payload from message content
            parsedPayload = {
              id: `SOS-${raw.id || Date.now().toString().slice(-6)}`,
              title: raw.title || '🚨 EMERGENCY SOS ALERT',
              message: raw.message || 'Incoming citizen emergency alert',
              type: raw.message?.includes('POLICE') ? 'Police' : raw.message?.includes('FIRE') ? 'Fire' : 'Medical',
              urgency: 'Critical',
              timestamp: new Date(raw.time * 1000).toISOString(),
              rawMessage: raw.message,
            };
          }

          onAlertReceived(parsedPayload);
        } catch (err) {
          console.warn('[SER Relay] Message parse error:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn('[SER Relay] Disconnected from emergency channel, reconnecting in 5s...', err);
        eventSource.close();
        if (!isClosed) {
          setTimeout(connect, 5000);
        }
      };
    } catch (e) {
      console.warn('[SER Relay] EventSource setup error:', e);
    }
  };

  connect();

  // Return unsubscribe cleanup function
  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
      console.log('[SER Relay] Disconnected from emergency channel.');
    }
  };
}
