import { useCallback, useEffect, useRef, useState } from 'react';

export function useStatusMessage(initialMessage = '') {
  const [statusMessage, setStatusMessage] = useState(initialMessage);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelStatusMessageTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelStatusMessageTimer(), [cancelStatusMessageTimer]);

  const updateStatusMessage = useCallback(
    (message: string, autoClearMs?: number) => {
      cancelStatusMessageTimer();
      setStatusMessage(message);

      if (autoClearMs && message) {
        timerRef.current = setTimeout(() => {
          setStatusMessage(current => (current === message ? '' : current));
          timerRef.current = null;
        }, autoClearMs);
      }
    },
    [cancelStatusMessageTimer]
  );

  const clearStatusMessage = useCallback(() => {
    cancelStatusMessageTimer();
    setStatusMessage('');
  }, [cancelStatusMessageTimer]);

  return { statusMessage, updateStatusMessage, clearStatusMessage };
}
