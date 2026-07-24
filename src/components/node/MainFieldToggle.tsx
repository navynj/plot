'use client';

import { createElement } from 'react';
import * as React from 'react';

import { setBooleanFieldAction } from '@/app/node/[id]/actions';
import { resolveLucideIcon } from '@/lib/lucideIcon';
import { cn } from '@/lib/utils';

export interface MainFieldCheck {
  /** stored lucide icon name (kebab-case); null → the default list glyph */
  icon: string | null;
  nodeId: string;
  fieldKey: string;
  checked: boolean;
  /** field label, for the toggle's accessible name / tooltip */
  label: string;
}

/** A show-on-main checkbox rendered as a toggleable square right on the stream:
 *  an empty outline square when off, a filled primary square (with the field
 *  icon) when on. Tapping flips it optimistically and saves; on failure it
 *  reverts. preventDefault stops a surrounding row link from navigating. */
function MainFieldToggle({ icon, nodeId, fieldKey, checked: initial, label }: MainFieldCheck) {
  const [checked, setChecked] = React.useState(initial);
  // re-sync when the server sends fresh state (after a save / navigation)
  const [prev, setPrev] = React.useState(initial);
  if (initial !== prev) {
    setPrev(initial);
    setChecked(initial);
  }
  const [pending, setPending] = React.useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    const next = !checked;
    setChecked(next);
    setPending(true);
    const res = await setBooleanFieldAction(nodeId, fieldKey, next);
    setPending(false);
    if (!res.ok) setChecked(!next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={checked}
      aria-label={`${label}${checked ? ' — done' : ''}`}
      title={label}
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-sm border transition',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input text-muted-foreground hover:bg-muted/50'
      )}
    >
      {createElement(resolveLucideIcon(icon), { className: 'size-2.5' })}
    </button>
  );
}

/** The row of show-on-main checkbox toggles under a node's title. */
export function MainFieldChecks({ checks }: { checks: MainFieldCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
      {checks.map((c) => (
        <MainFieldToggle key={c.fieldKey} {...c} />
      ))}
    </span>
  );
}
