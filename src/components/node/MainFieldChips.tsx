import { createElement } from 'react';

import { resolveLucideIcon } from '@/lib/lucideIcon';

export interface MainFieldChip {
  /** stored lucide icon name (kebab-case); null → the default list glyph */
  icon: string | null;
  /** already-formatted display value(s) — several for a multi-select option */
  values: string[];
}

/** The small "show on main" line under a node's title (stream / grid / inbox):
 *  a compact row of [icon] [value] chips. A multi-select option shows one small
 *  pill per chosen value; single-value fields render as plain text (unchanged).
 *  Purely presentational — used by both the client list and the server grid. */
export function MainFieldChips({ fields }: { fields: MainFieldChip[] }) {
  if (fields.length === 0) return null;
  return (
    <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      {fields.map((f, i) => (
        <span key={i} className="flex items-center gap-1">
          {createElement(resolveLucideIcon(f.icon), { className: 'size-3 shrink-0' })}
          {f.values.length === 1 ? (
            <span className="truncate">{f.values[0]}</span>
          ) : (
            f.values.map((v, j) => (
              <span key={j} className="bg-muted truncate rounded px-1">
                {v}
              </span>
            ))
          )}
        </span>
      ))}
    </span>
  );
}
