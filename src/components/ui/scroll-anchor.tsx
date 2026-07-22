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
  /** when set, on mount scroll this element (a CSS selector within) near the
   *  TOP instead of bottom-anchoring — B2 all-mode anchors today's header so
   *  future entries don't greet you. Also disables bottom-stick. */
  anchorSelector,
}: {
  className?: string;
  children: React.ReactNode;
  anchorSelector?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const stick = React.useRef(!anchorSelector);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (anchorSelector) {
      // anchor a specific element near the top (a small gap above it). Run
      // after layout (rAF) and use rect deltas so it's correct regardless of
      // the offsetParent — a bare on-mount read races the flex layout.
      const anchor = () => {
        const target = el.querySelector<HTMLElement>(anchorSelector);
        if (!target) return;
        const delta = target.getBoundingClientRect().top - el.getBoundingClientRect().top;
        el.scrollTop = Math.max(0, el.scrollTop + delta - 8);
      };
      anchor();
      // re-run across a couple of frames so late layout (sticky headers, font
      // metrics) doesn't leave today mis-anchored
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        anchor();
        raf2 = requestAnimationFrame(anchor);
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    el.scrollTop = el.scrollHeight; // open at the newest (chat/day mode)
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [anchorSelector]);

  // after every render (new content included): follow the bottom only if the
  // user was already there (chat/day mode only)
  React.useEffect(() => {
    const el = ref.current;
    if (el && stick.current && !anchorSelector) {
      el.scrollTop = el.scrollHeight;
    }
  });

  return (
    <div ref={ref} className={cn('overflow-y-auto', className)}>
      {children}
    </div>
  );
}
