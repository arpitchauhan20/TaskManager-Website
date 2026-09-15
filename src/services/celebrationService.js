import confetti from 'canvas-confetti';

/**
 * Trigger elegant high-altitude dual-corner celebratory confetti blasts from the bottom-left and bottom-right corners
 */
export function triggerDualCornerCelebration({ duration = 2200 } = {}) {
  try {
    const end = Date.now() + duration;
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#ffffff', '#ffd700'];

    // 1. Initial High-Altitude Dual Blast from Bottom Corners
    confetti({
      particleCount: 75,
      angle: 65, // Steeper upward launch
      spread: 60,
      origin: { x: 0, y: 1 },
      colors,
      startVelocity: 95, // High launch velocity for maximum height
      gravity: 0.82, // Floatier trajectory reaching top of screen
      ticks: 400,
      zIndex: 99999
    });

    confetti({
      particleCount: 75,
      angle: 115, // Steeper upward launch
      spread: 60,
      origin: { x: 1, y: 1 },
      colors,
      startVelocity: 95, // High launch velocity for maximum height
      gravity: 0.82, // Floatier trajectory reaching top of screen
      ticks: 400,
      zIndex: 99999
    });

    // 2. Controlled High-Arch Wave Streams from both corners
    const interval = setInterval(() => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 35 * (timeLeft / duration);

      // Bottom-Left Corner Cannon
      confetti({
        particleCount: Math.floor(particleCount),
        angle: 62 + Math.random() * 12,
        spread: 55,
        origin: { x: 0, y: 0.98 },
        colors,
        startVelocity: 85 + Math.random() * 12,
        gravity: 0.84,
        ticks: 350,
        zIndex: 99999
      });

      // Bottom-Right Corner Cannon
      confetti({
        particleCount: Math.floor(particleCount),
        angle: 118 - Math.random() * 12,
        spread: 55,
        origin: { x: 1, y: 0.98 },
        colors,
        startVelocity: 85 + Math.random() * 12,
        gravity: 0.84,
        ticks: 350,
        zIndex: 99999
      });
    }, 240);
  } catch (err) {
    console.warn('Celebration trigger note:', err);
  }
}

