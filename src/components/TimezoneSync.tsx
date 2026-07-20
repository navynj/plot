'use client';

import * as React from 'react';

/** Detects the browser's IANA timezone and keeps the tz cookie fresh — no
 *  settings UI; traveling updates it naturally on next load. */
export function TimezoneSync() {
  React.useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      document.cookie = `tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);
  return null;
}
