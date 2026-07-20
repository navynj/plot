'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface ScalePickerProps {
  name: string;
  min: number;
  max: number;
  step: number;
  value?: number;
}

/** Segmented scale for a fully-constrained number with few points (≤11): the
 *  points on a horizontal line, tap to select, selected point distinct with
 *  its value labeled. Same number type, same numberValue storage — only the
 *  editor differs. */
export function ScalePicker({ name, min, max, step, value }: ScalePickerProps) {
  const points = React.useMemo(() => {
    const out: number[] = [];
    for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e9) / 1e9);
    return out;
  }, [min, max, step]);
  const [selected, setSelected] = React.useState<number | undefined>(value);

  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name={name} value={selected ?? ''} />
      <div className="flex items-center justify-between gap-1">
        {points.map((p) => (
          <button
            key={p}
            type="button"
            aria-label={`select ${p}`}
            aria-pressed={selected === p}
            onClick={() => setSelected((s) => (s === p ? undefined : p))}
            className="group flex flex-1 flex-col items-center gap-1 py-1"
          >
            <span
              className={cn(
                'size-3.5 rounded-full border transition-all',
                selected === p
                  ? 'border-primary bg-primary scale-125'
                  : 'border-border bg-muted group-hover:border-primary/50'
              )}
            />
            <span
              className={cn(
                'text-[10px] tabular-nums',
                selected === p ? 'text-foreground font-semibold' : 'text-muted-foreground/60'
              )}
            >
              {p}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
