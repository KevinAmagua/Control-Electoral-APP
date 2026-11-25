import { useCallback, useEffect, useState } from 'react';

import { dataContainer } from '@/data/container';
import type { Result } from '@/core/result/result';

export function useOutboxSync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => dataContainer.outbox.subscribe(() => {
    setRevision((value) => value + 1);
  }), []);

  const flush = useCallback(async (): Promise<Result<number>> => {
    setSyncing(true);
    setError(null);
    const result = await dataContainer.outbox.flushPending();
    setSyncing(false);
    if (!result.ok) {
      setError(result.error.message);
    }
    return result;
  }, []);

  return { flush, syncing, error, revision };
}
