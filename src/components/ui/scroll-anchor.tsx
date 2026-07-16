'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const STICK_THRESHOLD_PX = 80;

/**
 * Generic chat-style scroll container. Content fills from the top; when it
 * overflows, the view opens anchored to the bottom (newest) and follows new
 * content only while the user is already at the bottom — scrolling up to read
 * history is never interrupted.
 */
export function ScrollAnchor({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const stick = React.useRef(true);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight; // open at the newest
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // after every render (new content included): follow the bottom only if
  // the user was already there
  React.useEffect(() => {
    const el = ref.current;
    if (el && stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  });

  return (
    <div ref={ref} className={cn('overflow-y-auto', className)}>
      {children}
    </div>
  );
}
