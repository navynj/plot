'use client';

import { redoAction, undoAction } from '@/app/triage/actions';
import { createSerialGate } from '@/lib/serialize';

/** ONE gate across every undo/redo entry point — the toast Undo tap and the
 *  Ctrl+Z / Ctrl+Y hotkeys act on the SAME stack, so they share the same
 *  lock. While one apply settles, further invocations return undefined
 *  without running: hammering applies exactly one stack entry per settled
 *  call. This matters doubly here — undo/redo pop-then-apply isn't atomic
 *  (no transactions on neon-http), so a client-side overlap must never be
 *  able to double-pop one entry. */
const gate = createSerialGate();

export const runUndo = () => gate(undoAction);
export const runRedo = () => gate(redoAction);
