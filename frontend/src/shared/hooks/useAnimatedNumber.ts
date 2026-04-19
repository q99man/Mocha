import { useEffect, useState } from 'react';

type UseAnimatedNumberOptions = {
  duration?: number;
  decimals?: number;
};

export function useAnimatedNumber(target: number, options: UseAnimatedNumberOptions = {}) {
  const { duration = 1400, decimals = 0 } = options;
  const [animatedValue, setAnimatedValue] = useState(() => roundValue(target, decimals));

  useEffect(() => {
    const safeTarget = Number.isFinite(target) ? target : 0;

    if (duration <= 0) {
      setAnimatedValue(roundValue(safeTarget, decimals));
      return;
    }

    let frameId = 0;
    let startTime: number | null = null;

    setAnimatedValue(0);

    const tick = (timestamp: number) => {
      if (startTime == null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 4);
      const nextValue = safeTarget * easedProgress;

      setAnimatedValue(roundValue(nextValue, decimals));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [decimals, duration, target]);

  return animatedValue;
}

function roundValue(value: number, decimals: number) {
  if (decimals <= 0) {
    return Math.round(value);
  }

  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
