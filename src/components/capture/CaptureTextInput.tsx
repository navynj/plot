'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';

/** The capture text input, IME-composition-safe: Enter submits the form ONLY
 *  when no composition is active — the Enter that confirms a Korean syllable
 *  (KeyboardEvent.isComposing, legacy keyCode 229) never submits. All capture
 *  surfaces are single-line Inputs, so Shift+Enter/newlines don't apply —
 *  behavior is uniform across home, in-node, and timeline-day capture. */
export function CaptureTextInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      type="text"
      autoComplete="off"
      {...props}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
          e.preventDefault(); // composition-confirm, not a submit
        }
        props.onKeyDown?.(e);
      }}
    />
  );
}
