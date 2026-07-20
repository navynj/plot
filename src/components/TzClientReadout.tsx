'use client';

import * as React from 'react';

const subscribe = () => () => {};

/** The browser's side of the three-way readout (SSR-safe via
 *  useSyncExternalStore server snapshots). */
export function TzClientReadout() {
  const detected = React.useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? '(none)',
    () => '…'
  );
  const cookie = React.useSyncExternalStore(
    subscribe,
    () =>
      document.cookie.split('; ').find((c) => c.startsWith('tz=')) ??
      '(no tz cookie in document.cookie)',
    () => '…'
  );
  return (
    <section className="border-border rounded-md border p-3">
      <h2 className="text-muted-foreground font-sans text-xs uppercase">browser (this device)</h2>
      <p>Intl detected&nbsp;&nbsp;: {detected}</p>
      <p>document.cookie: {cookie}</p>
    </section>
  );
}
