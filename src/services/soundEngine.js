// ==========================================
// Web Audio API Executive Sound Engine
// Sustained 10+ Second Ringing Engine
// ==========================================
let audioCtx = null;
const activeNodes = new Set();

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
  // Stop all currently ringing sounds immediately
  stopAll() {
    activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch {
        // ignore already stopped
      }
    });
    activeNodes.clear();
  },

  // Sustained 10+ Second Grand Executive Melodic Chime Sequence
  playReminderChime(soundEnabled = true) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Helper function to synthesize realistic harmonic acoustic bell strikes
      const strikeBell = (freq, startTime, duration = 2.4, volume = 0.28) => {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, startTime);

        gain1.gain.setValueAtTime(0, startTime);
        gain1.gain.linearRampToValueAtTime(volume, startTime + 0.015);
        gain1.gain.exponentialRampToValueAtTime(0.0006, startTime + duration);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(startTime);
        osc1.stop(startTime + duration + 0.05);

        activeNodes.add(osc1);
        osc1.onended = () => activeNodes.delete(osc1);

        // Harmonic overtone (brass/bronze bell shimmer at ~2.012x freq)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.012, startTime);

        gain2.gain.setValueAtTime(0, startTime);
        gain2.gain.linearRampToValueAtTime(volume * 0.35, startTime + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.0004, startTime + duration * 0.75);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(startTime);
        osc2.stop(startTime + duration * 0.8);

        activeNodes.add(osc2);
        osc2.onended = () => activeNodes.delete(osc2);
      };

      // 10+ Second Melodic Grand Chime Sequence:
      // Part 1: Ascending C-Major triad (0.0s - 2.8s)
      strikeBell(1046.5, now + 0.00, 2.2, 0.28); // C6
      strikeBell(1318.5, now + 0.70, 2.2, 0.26); // E6
      strikeBell(1567.9, now + 1.40, 2.4, 0.26); // G6
      strikeBell(2093.0, now + 2.10, 2.6, 0.30); // C7

      // Part 2: Harmonic response bridge (3.5s - 6.0s)
      strikeBell(1567.9, now + 3.50, 2.4, 0.24); // G6
      strikeBell(1760.0, now + 4.20, 2.4, 0.25); // A6
      strikeBell(1975.5, now + 4.90, 2.5, 0.26); // B6
      strikeBell(2093.0, now + 5.60, 2.8, 0.28); // C7

      // Part 3: Grand final resonance ringing through to 10.5+ seconds
      strikeBell(1046.5, now + 6.80, 3.8, 0.26); // C6 base
      strikeBell(1567.9, now + 7.40, 3.4, 0.26); // G6 middle
      strikeBell(2093.0, now + 8.00, 3.2, 0.32); // High C7 grand resonance (rings past 10.5s)
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

        activeNodes.add(osc);
        osc.onended = () => activeNodes.delete(osc);
      });
    } catch (e) {
      console.warn('Audio success error:', e);
    }
  },

  // Direct alias for playReminderChime
  playBellChime(soundEnabled = true) {
    return this.playReminderChime(soundEnabled);
  },

  // Urgent, executive alarm sound that rings continuously for at least 10 seconds (10.5s total)
  playAlarm(soundEnabled = true) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 8 rhythmic alarm bursts spaced across 10.5 seconds
      const strikeOffsets = [
        0.00, 0.22,
        1.25, 1.47,
        2.50, 2.72,
        3.75, 3.97,
        5.00, 5.22,
        6.25, 6.47,
        7.50, 7.72,
        8.75, 8.97
      ];

      strikeOffsets.forEach((timeOffset, i) => {
        const freq = i % 2 === 0 ? 1760 : 2093; // Alternating A6 -> C7
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);

        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.32, now + timeOffset + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0006, now + timeOffset + 0.55);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.6);

        activeNodes.add(osc);
        osc.onended = () => activeNodes.delete(osc);
      });

      // Grand sustaining finale bell strike at 9.5s that rings past 10.5s
      const finalOsc = ctx.createOscillator();
      const finalGain = ctx.createGain();
      finalOsc.type = 'sine';
      finalOsc.frequency.setValueAtTime(2093, now + 9.5); // High C7

      finalGain.gain.setValueAtTime(0, now + 9.5);
      finalGain.gain.linearRampToValueAtTime(0.35, now + 9.5 + 0.02);
      finalGain.gain.exponentialRampToValueAtTime(0.0005, now + 10.8);

      finalOsc.connect(finalGain);
      finalGain.connect(ctx.destination);
      finalOsc.start(now + 9.5);
      finalOsc.stop(now + 10.85);

      activeNodes.add(finalOsc);
      finalOsc.onended = () => activeNodes.delete(finalOsc);
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
