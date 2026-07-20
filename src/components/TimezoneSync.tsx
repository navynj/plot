'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

const COOKIE = 'tz';

function readCookie(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function writeCookie(tz: string) {
  // written RAW — '/' is a legal cookie-value octet, and parsers differ on
  // percent-decoding (the bug this component earned its reconcile for)
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${COOKIE}=${tz}; path=/; max-age=31536000; samesite=lax${secure}`;
}

/**
 * RECONCILES the timezone, not just writes it: on load and on
 * visibilitychange (an installed PWA resumes from the switcher — it never
 * relaunches, so navigation-based healing never triggers), compare the
 * browser's detected zone against the cookie; on a real mismatch, write the
 * cookie AND refresh the current view so it re-renders through the correct
 * lens immediately. Guarded per detected value — zero refreshes when nothing
 * changed, no refresh loops when cookies are blocked.
 */
export function TimezoneSync() {
  const router = useRouter();
  const refreshedFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    const reconcile = () => {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!detected) return;
      const cookie = readCookie();
      const matches =
        cookie !== undefined && (cookie === detected || safeDecode(cookie) === detected);
      writeCookie(detected); // raw form + refreshed expiry, always
      if (!matches && refreshedFor.current !== detected) {
        refreshedFor.current = detected;
        router.refresh(); // re-lens the CURRENT view, no navigation needed
      }
    };
    reconcile();
    const onVisible = () => {
      if (document.visibilityState === 'visible') reconcile();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [router]);

  return null;
}
