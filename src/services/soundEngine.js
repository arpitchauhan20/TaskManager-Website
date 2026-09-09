// ==========================================
// Web Audio API Executive Sound Engine
// ==========================================
let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const SoundFX = {
  // Long, sustained 5.5-second executive melodic chime sequence
  playReminderChime(soundEnabled = true) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Helper function to synthesize a realistic harmonic bell strike
      const strikeBell = (freq, startTime, duration = 1.4, volume = 0.28) => {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, startTime);

        gain1.gain.setValueAtTime(0, startTime);
        gain1.gain.linearRampToValueAtTime(volume, startTime + 0.015);
        gain1.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(startTime);
        osc1.stop(startTime + duration + 0.05);

        // Harmonic overtone (brass/bronze bell shimmer at ~2.01x freq)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.012, startTime);

        gain2.gain.setValueAtTime(0, startTime);
        gain2.gain.linearRampToValueAtTime(volume * 0.35, startTime + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.0005, startTime + duration * 0.7);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(startTime);
        osc2.stop(startTime + duration * 0.75);
      };

      // 4-Note Melodic Sequence: C6 (1046.5Hz) -> E6 (1318.5Hz) -> G6 (1567.9Hz) -> Sustained High C7 (2093Hz)
      strikeBell(1046.5, now + 0.00, 1.8, 0.28);
      strikeBell(1318.5, now + 0.45, 1.8, 0.26);
      strikeBell(1567.9, now + 0.90, 2.0, 0.26);
      strikeBell(2093.0, now + 1.40, 4.0, 0.32); // 4-second grand resonance (total duration ~5.5s)
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  },

  // Uplifting 3-note victory major chord
  playSuccessChord(soundEnabled = true) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.85);
      });
    } catch (e) {
      console.warn('Audio success error:', e);
    }
  },

  // Direct alias for playReminderChime
  playBellChime(soundEnabled = true) {
    return this.playReminderChime(soundEnabled);
  },

  // Loud, urgent double-strike alarm sound for deadline / reminder trigger
  playAlarm(soundEnabled = true) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Strike 2 high-urgency executive bells in rapid succession
      [0.0, 0.22, 0.65, 0.88].forEach((timeOffset, i) => {
        const freq = i % 2 === 0 ? 1760 : 2093; // A6 -> C7
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);

        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.35, now + timeOffset + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + timeOffset + 0.55);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.6);
      });
    } catch (e) {
      console.warn('Play alarm error:', e);
    }
  },

  // Resume / unlock AudioContext on first user interaction
  unlockAudio() {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (e) {
      // Ignored
    }
  }
};
