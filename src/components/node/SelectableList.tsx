'use client';

import { CornerLeftUp } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { ParentPicker } from '@/components/node/ParentPicker';
import { BulkBar, toastWithUndo } from '@/components/node/BulkBar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export interface SelectableRow {
  id: string;
  label: string;
  time: string;
  parented: boolean;
  childCount: number;
}

export interface SelectableGroup {
  key: string;
  /** day label in the stream; null = headerless (the inbox) */
  header: string | null;
  rows: SelectableRow[];
}

/** The primary triage surface: checkboxes on every row, a global select-all,
 *  per-day select-alls on stream section headers, and the bulk action bar on
 *  selection. Single-row ↰ pickers stay for one-off moves. */
export function SelectableList({ groups }: { groups: SelectableGroup[] }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const allRows = React.useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const byId = React.useMemo(() => new Map(allRows.map((r) => [r.id, r])), [allRows]);
  // prune selections that vanished (moved away / deleted / undone)
  const liveSelected = [...selected].filter((id) => byId.has(id));

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
          <section key={group.key}>
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
            <ul className="divide-border divide-y">
              {group.rows.map((row) => (
                <li key={row.id} className="group flex items-center gap-2 py-2">
                  <Checkbox
                    aria-label={`select ${row.label}`}
                    checked={selected.has(row.id)}
                    onCheckedChange={() => toggle(row.id)}
                  />
                  <Link
                    href={`/node/${row.id}`}
                    className="flex-1 truncate text-sm hover:underline"
                  >
                    {row.label}
                  </Link>
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
                  <time className="text-muted-foreground shrink-0 text-xs">{row.time}</time>
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
        onClear={() => setSelected(new Set())}
      />
    </>
  );
}
