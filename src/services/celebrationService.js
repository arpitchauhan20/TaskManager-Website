import confetti from 'canvas-confetti';

/**
 * Trigger intense dual-corner celebratory confetti blasts from the bottom-left and bottom-right corners
 */
export function triggerDualCornerCelebration({ duration = 3000 } = {}) {
  try {
    const end = Date.now() + duration;
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#ffffff', '#ffd700'];

    // 1. Initial Mega Blast from Bottom-Left and Bottom-Right Corners
    confetti({
      particleCount: 130,
      angle: 60,
      spread: 80,
      origin: { x: 0, y: 1 },
      colors,
      startVelocity: 75,
      ticks: 350,
      zIndex: 99999
    });

    confetti({
      particleCount: 130,
      angle: 120,
      spread: 80,
      origin: { x: 1, y: 1 },
      colors,
      startVelocity: 75,
      ticks: 350,
      zIndex: 99999
    });

    // 2. Cascading High-Quantity Wave Streams from both corners
    const interval = setInterval(() => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 70 * (timeLeft / duration);

      // Bottom-Left Corner Cannon
      confetti({
        particleCount: Math.floor(particleCount),
        angle: 55 + Math.random() * 20,
        spread: 70,
        origin: { x: 0, y: 0.95 },
        colors,
        startVelocity: 60 + Math.random() * 18,
        ticks: 280,
        zIndex: 99999
      });

      // Bottom-Right Corner Cannon
      confetti({
        particleCount: Math.floor(particleCount),
        angle: 125 - Math.random() * 20,
        spread: 70,
        origin: { x: 1, y: 0.95 },
        colors,
        startVelocity: 60 + Math.random() * 18,
        ticks: 280,
        zIndex: 99999
      });
    }, 180);
  } catch (err) {
    console.warn('Celebration trigger note:', err);
  }
}
