'use client';

import * as React from 'react';

import { createSerialGate } from '@/lib/serialize';

/** Pending lock for tap-commit paths — mutations that fire from a tap, not a
 *  form submit, where the useFormStatus/SubmitButton net can't reach. `run`
 *  executes at most one action at a time: overlapping taps are dropped
 *  synchronously by the gate (state alone lags a frame under hammering).
 *  `pendingKey` names the tapped item so it alone spins while the whole
 *  surface goes inert; the key clears on settle either way, so a failure
 *  re-enables the surface. */
export function usePendingLock() {
  const [gate] = React.useState(() => createSerialGate());
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const run = React.useCallback(
    (key: string, action: () => Promise<void>) =>
      gate(async () => {
        setPendingKey(key);
        try {
          await action();
        } finally {
          setPendingKey(null);
        }
      }),
    [gate]
  );
  return { pending: pendingKey !== null, pendingKey, run };
}
