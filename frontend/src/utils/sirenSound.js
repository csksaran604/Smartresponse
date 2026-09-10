/**
 * Web Audio API Emergency Siren Sound Synthesizer
 * Generates an unmistakable, high-urgency emergency alarm wail entirely in-browser
 * without downloading external audio files.
 */

let audioCtx = null;
let oscillator = null;
let gainNode = null;
let isSirenPlaying = false;
let lfo = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Starts the emergency siren alarm
 */
export function startEmergencySiren() {
  if (isSirenPlaying) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Main oscillator for siren tone
    oscillator = ctx.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 750; // Base frequency in Hz

    // Gain node for volume
    gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.18, ctx.currentTime);

    // LFO (Low Frequency Oscillator) to modulate frequency (wailing effect)
    lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1.8; // Modulation speed (cycles per second)

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220; // Sweep range (+/- 220 Hz between 530Hz and 970Hz)

    // Connect LFO -> oscillator frequency
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);

    // Connect oscillator -> gain -> destination
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    lfo.start();
    isSirenPlaying = true;
  } catch (err) {
    console.warn('Could not start emergency siren audio:', err);
  }
}

/**
 * Stops the emergency siren alarm
 */
export function stopEmergencySiren() {
  if (!isSirenPlaying) return;

  try {
    if (oscillator) {
      oscillator.stop();
      oscillator.disconnect();
      oscillator = null;
    }
    if (lfo) {
      lfo.stop();
      lfo.disconnect();
      lfo = null;
    }
    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }
    isSirenPlaying = false;
  } catch (err) {
    console.warn('Error stopping emergency siren:', err);
  }
}

/**
 * Plays a single short emergency ping chime
 */
export function playAlertChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}
