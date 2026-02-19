import { useState, useEffect, useRef } from 'react';

export function useEntranceControl(
  entranceAllowed: boolean,
  entranceAt: string | null,
  onEntranceOpen: () => void
) {
  const [countdown, setCountdown] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (entranceAllowed || !entranceAt) {
      setCountdown(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const update = () => {
      const target = new Date(entranceAt).getTime();
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));

      if (diff <= 0) {
        setCountdown(null);
        onEntranceOpen();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      const ss = s.toString().padStart(2, '0');

      if (h > 0) setCountdown(`${h}時間${m}分${ss}秒`);
      else if (m > 0) setCountdown(`${m}分${ss}秒`);
      else setCountdown(`${diff}秒`);
    };

    update();
    intervalRef.current = setInterval(update, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [entranceAllowed, entranceAt]);

  return { entranceCountdown: countdown };
}
