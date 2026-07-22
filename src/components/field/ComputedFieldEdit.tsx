'use client';

import * as React from 'react';

import type { FieldDef, FieldPrimitive } from '@/db/schema';
import { Input } from '@/components/ui/input';

import { formatDuration } from './types/duration';

const MS_PER_MINUTE = 60_000;

function toDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Editor for a computed duration field. Computation is the default: when both
 *  source timestamps (compute.from / compute.to, ordinary sibling inputs in the
 *  same form) are filled, the value shows read-only and the service recomputes
 *  it on save — so nothing needs to submit for this key. When either source is
 *  empty, an editable duration input takes over (manual fallback). Reactive to
 *  the sibling inputs, so it flips live as the user fills the timestamps. */
export function ComputedFieldEdit({
  def,
  value,
}: {
  def: FieldDef;
  value: FieldPrimitive | undefined;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [computed, setComputed] = React.useState<number | null>(null);
  const [bothPresent, setBothPresent] = React.useState(false);
  const fromKey = def.compute?.from;
  const toKey = def.compute?.to;

  React.useEffect(() => {
    if (!fromKey || !toKey) return;
    const form = ref.current?.closest('form');
    if (!form) return;
    const fromEl = form.elements.namedItem(fromKey) as HTMLInputElement | null;
    const toEl = form.elements.namedItem(toKey) as HTMLInputElement | null;
    const recompute = () => {
      const from = toDate(fromEl?.value);
      const to = toDate(toEl?.value);
      if (from && to) {
        setBothPresent(true);
        setComputed((to.getTime() - from.getTime()) / MS_PER_MINUTE);
      } else {
        setBothPresent(false);
        setComputed(null);
      }
    };
    recompute();
    fromEl?.addEventListener('input', recompute);
    toEl?.addEventListener('input', recompute);
    return () => {
      fromEl?.removeEventListener('input', recompute);
      toEl?.removeEventListener('input', recompute);
    };
  }, [fromKey, toKey]);

  const manualDefault =
    typeof value === 'number'
      ? `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`
      : undefined;

  return (
    <div ref={ref}>
      {bothPresent ? (
        <Input
          readOnly
          disabled
          aria-label={`${def.label} (computed)`}
          value={computed !== null && computed >= 0 ? formatDuration(computed) : '—'}
        />
      ) : (
        <Input name={def.key} placeholder="HH:MM or minutes" defaultValue={manualDefault} />
      )}
    </div>
  );
}
