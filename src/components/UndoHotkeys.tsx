'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { runRedo, runUndo } from '@/components/undoRunner';

/** Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo. Never fires during
 *  IME composition, and never hijacks text-editing undo inside inputs. Runs
 *  through the shared undo gate: hammering Z applies exactly one stack entry
 *  per settled call (overlapping presses are dropped, silently). */
export function UndoHotkeys() {
  React.useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return; // native text undo owns the keys inside editors
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;
      e.preventDefault();
      const result = isUndo ? await runUndo() : await runRedo();
      if (!result) return; // gate dropped an overlapping press — one is applying
      if (result.ok) toast(result.description ?? (isUndo ? 'undone' : 'redone'));
      else toast(`nothing to ${isUndo ? 'undo' : 'redo'}`);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return null;
}
