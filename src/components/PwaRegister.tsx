'use client';

import * as React from 'react';

/** Registers the pass-through service worker (install criteria only). */
export function PwaRegister() {
  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js');
    }
  }, []);
  return null;
}
