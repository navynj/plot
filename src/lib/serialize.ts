/** A serial gate: at most one guarded async call in flight at a time.
 *  Overlapping calls are DROPPED (resolve to `undefined` without running),
 *  never queued — the caller's UI shows pending, so a second tap is a
 *  mis-tap, not new intent. The check is synchronous, so hammering inside
 *  one frame still applies exactly once. Errors release the gate and
 *  propagate. */
export function createSerialGate() {
  let inFlight = false;
  return async function guard<R>(fn: () => Promise<R>): Promise<R | undefined> {
    if (inFlight) return undefined;
    inFlight = true;
    try {
      return await fn();
    } finally {
      inFlight = false;
    }
  };
}
