import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function storageKey(userId: number | string | undefined, key: string) {
  return `pref:${userId ?? 'guest'}:${key}`;
}

export function useUserPreference<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const { user } = useAuth();
  const userId = user?.id;

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey(userId, key));
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(userId, key));
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      } else {
        setValue(defaultValue);
      }
    } catch {
      setValue(defaultValue);
    }
  }, [userId, key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(storageKey(userId, key), JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    },
    [userId, key]
  );

  return [value, update];
}
