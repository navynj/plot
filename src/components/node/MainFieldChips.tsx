import { MainFieldIcon } from '@/components/field/mainFieldIcons';

export interface MainFieldChip {
  /** lucide icon name (null → the default list glyph) */
  icon: string | null;
  /** already-formatted display value */
  value: string;
}

/** The small "show on main" line under a node's title (stream / grid / inbox):
 *  a compact row of [filled icon] [value] chips. Purely presentational — used
 *  by both the client list and the server grid. */
export function MainFieldChips({ fields }: { fields: MainFieldChip[] }) {
  if (fields.length === 0) return null;
  return (
    <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      {fields.map((f, i) => (
        <span key={i} className="flex items-center gap-1">
          <MainFieldIcon name={f.icon} className="size-3 shrink-0 fill-current" />
          <span className="truncate">{f.value}</span>
        </span>
      ))}
    </span>
  );
}
