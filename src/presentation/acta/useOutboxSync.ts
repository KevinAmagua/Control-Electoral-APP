import { useCallback, useEffect, useState } from 'react';

import { dataContainer } from '@/data/container';
import type { Result } from '@/core/result/result';

let activeScreens = 0;
let starting: Promise<void> | null = null;

export function useOutboxSync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    activeScreens += 1;
    if (activeScreens === 1) {
      starting = dataContainer.outbox.start().catch(() => undefined);
    }

    return () => {
      activeScreens -= 1;
      if (activeScreens <= 0) {
        activeScreens = 0;
        dataContainer.outbox.stop();
        starting = null;
      }
    };
  }, []);

  const flush = useCallback(async (): Promise<Result<number>> => {
    if (starting) {
      await starting;
    }
    setSyncing(true);
    setError(null);
    const result = await dataContainer.outbox.flushPending();
    setSyncing(false);
    if (!result.ok) {
      setError(result.error.message);
    }
    return result;
  }, []);

  return { flush, syncing, error };
}
