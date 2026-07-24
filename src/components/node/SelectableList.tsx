'use client';

import { CornerLeftUp } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { ParentPicker } from '@/components/node/ParentPicker';
import { BulkBar, toastWithUndo } from '@/components/node/BulkBar';
import { MainFieldChips, type MainFieldChip } from '@/components/node/MainFieldChips';
import { MainFieldChecks, type MainFieldCheck } from '@/components/node/MainFieldToggle';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export interface SelectableRow {
  id: string;
  label: string;
  /** resolved display icon (own -> link target -> ancestors); null = none anywhere */
  icon: string | null;
  time: string;
  parented: boolean;
  childCount: number;
  /** the current parent as a navigable chip (B2 item 5); null = inbox row */
  parent?: { id: string; icon: string | null; name: string } | null;
  /** show-on-main field values, shown small under the title (Task 2) */
  fields?: MainFieldChip[];
  /** show-on-main checkbox fields, as toggleable squares under the title */
  checks?: MainFieldCheck[];
}

export interface SelectableGroup {
  key: string;
  /** day label in the stream; null = headerless (the inbox / single-day) */
  header: string | null;
  /** marks the today group so all-mode can anchor its initial scroll here */
  isToday?: boolean;
  /** rendered under the header, above the rows — the day's habit toggle row */
  accessory?: React.ReactNode;
  rows: SelectableRow[];
}

/** The primary triage surface: checkboxes on every row, a global select-all,
 *  per-day select-alls on stream section headers, and the bulk action bar on
 *  selection. Single-row ↰ pickers stay for one-off moves. */
export function SelectableList({
  groups,
  warnOnMove = true,
}: {
  groups: SelectableGroup[];
  /** false on the children-list surface (see BulkBar.warnOnMove) */
  warnOnMove?: boolean;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const allRows = React.useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const byId = React.useMemo(() => new Map(allRows.map((r) => [r.id, r])), [allRows]);
  // prune selections that vanished (moved away / deleted / undone), and keep
  // DISPLAYED order (stream: timeline, inbox: rank), not click order — the
  // field walk runs over this list in this order
  const liveSelected = allRows.filter((r) => selected.has(r.id)).map((r) => r.id);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMany = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const allSelected = allRows.length > 0 && liveSelected.length === allRows.length;

  return (
    <>
      {allRows.length > 0 && (
        <label className="text-muted-foreground flex items-center gap-2 py-1 text-xs">
          <Checkbox
            aria-label="select all"
            checked={allSelected}
            onCheckedChange={(on) =>
              setMany(
                allRows.map((r) => r.id),
                on === true
              )
            }
          />
          select all
        </label>
      )}
      {groups.map((group) => {
        const groupIds = group.rows.map((r) => r.id);
        const groupAll = groupIds.length > 0 && groupIds.every((id) => selected.has(id));
        return (
          <section key={group.key} data-stream-today={group.isToday ? '' : undefined}>
            {group.header !== null && (
              <h2 className="text-muted-foreground bg-background sticky top-0 flex items-center gap-2 py-1 text-xs font-medium tracking-wider uppercase">
                <Checkbox
                  aria-label={`select all of ${group.header}`}
                  checked={groupAll}
                  onCheckedChange={(on) => setMany(groupIds, on === true)}
                />
                {group.header}
              </h2>
            )}
            {group.accessory}
            <ul className="divide-border divide-y">
              {group.rows.map((row) => (
                <li key={row.id} className="group flex items-center gap-2 py-2">
                  <Checkbox
                    aria-label={`select ${row.label}`}
                    checked={selected.has(row.id)}
                    onCheckedChange={() => toggle(row.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/node/${row.id}`}
                      className="block truncate text-sm hover:underline"
                    >
                      {row.icon && <span className="mr-1.5">{row.icon}</span>}
                      {row.label}
                    </Link>
                    {row.checks && row.checks.length > 0 && (
                      <MainFieldChecks checks={row.checks} />
                    )}
                    {row.fields && row.fields.length > 0 && <MainFieldChips fields={row.fields} />}
                  </span>
                  {/* the current parent as a chip: tap = navigate to the room
                      (mirrors node-detail's "tap name = navigate"). Inbox rows
                      have no parent — just the ↰ picker. */}
                  {row.parent && (
                    <Link
                      href={`/node/${row.parent.id}`}
                      className="border-border text-muted-foreground hover:bg-muted/50 flex max-w-24 shrink-0 items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs sm:max-w-32"
                    >
                      {row.parent.icon && <span>{row.parent.icon}</span>}
                      <span className="truncate">{row.parent.name}</span>
                    </Link>
                  )}
                  <ParentPicker nodeIds={[row.id]} onMoved={() => toastWithUndo('Moved')}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="set parent"
                      className="text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                    >
                      <CornerLeftUp className="size-3.5" />
                    </Button>
                  </ParentPicker>
                  {/* allowed to shrink and wrap (not shrink-0) so a long
                      timestamp never forces horizontal overflow on mobile */}
                  <time className="text-muted-foreground shrink text-right text-xs">
                    {row.time}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <BulkBar
        selectedIds={liveSelected}
        parentedCount={liveSelected.filter((id) => byId.get(id)?.parented).length}
        withChildrenCount={liveSelected.filter((id) => (byId.get(id)?.childCount ?? 0) > 0).length}
        warnOnMove={warnOnMove}
        onClear={() => setSelected(new Set())}
      />
    </>
  );
}
