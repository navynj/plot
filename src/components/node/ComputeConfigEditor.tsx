'use client';

import type { FieldDef } from '@/db/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Compute = NonNullable<FieldDef['compute']>;

/** Configure a computed field: pick the two timestamp fields it subtracts
 *  (`to` − `from`). When both are set the schema editor auto-adds a `to > from`
 *  validation rule (via onEnsureRule) so the pair stays ordered — the computed
 *  duration is always positive, no overnight wraparound. */
export function ComputeConfigEditor({
  compute,
  timestampFields,
  onChange,
  onEnsureRule,
}: {
  compute: Compute | undefined;
  /** sibling fields of type timestamp — the only valid sources */
  timestampFields: { key: string; label: string }[];
  onChange(compute: Compute | undefined): void;
  /** ensure a `toKey > fromKey` rule exists on the `to` field */
  onEnsureRule(toKey: string, fromKey: string): void;
}) {
  if (timestampFields.length < 2) {
    return (
      <span className="text-muted-foreground/70">
        add two timestamp fields to compute a duration
      </span>
    );
  }

  const set = (end: 'from' | 'to', key: string) => {
    const next: Compute = { from: compute?.from ?? '', to: compute?.to ?? '', [end]: key };
    onChange(next);
    if (next.from && next.to && next.from !== next.to) onEnsureRule(next.to, next.from);
  };

  const picker = (end: 'from' | 'to', label: string) => (
    <label className="flex items-center gap-1">
      {label}
      <Select value={compute?.[end] || undefined} onValueChange={(v) => set(end, v)}>
        <SelectTrigger size="sm" className="w-28">
          <SelectValue placeholder="field…" />
        </SelectTrigger>
        <SelectContent>
          {timestampFields.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );

  return (
    <span className="flex items-center gap-2">
      {picker('from', 'from')}
      {picker('to', 'to')}
    </span>
  );
}
