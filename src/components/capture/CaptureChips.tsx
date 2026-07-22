'use client';

import * as React from 'react';

import { chipChildren } from '@/app/actions';
import type { CaptureChipTiers, ChipItem } from '@/service/node';
import { cn } from '@/lib/utils';

/**
 * B2 three-tier capture chips with recursive drill-down.
 *
 * Tiers: Favorites, Ongoing, Top-level (confirmed roots). Tapping a chip
 * splits by whether it has record children:
 *  - LEAF → commits it as the capture parent (B1 inline fields then appear).
 *  - HAS CHILDREN → expands: a row of its children appears below, its siblings
 *    dim, and the parent itself leads that row as "→ this room" so you can
 *    still capture into it. Drilling is recursive; re-tapping an expanded chip
 *    collapses it. Drill (navigate) and select (commit) are separate taps, so
 *    they never collide.
 */
export function CaptureChips({
  tiers,
  selectedId,
  onSelect,
}: {
  tiers: CaptureChipTiers;
  selectedId: string | null;
  onSelect: (chip: ChipItem | null) => void;
}) {
  const [path, setPath] = React.useState<ChipItem[]>([]);
  const [childrenByParent, setChildrenByParent] = React.useState<Record<string, ChipItem[]>>({});
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const expand = async (chip: ChipItem) => {
    setPath((p) => [...p, chip]);
    if (!childrenByParent[chip.id]) {
      setLoadingId(chip.id);
      const kids = await chipChildren(chip.id);
      setChildrenByParent((m) => ({ ...m, [chip.id]: kids }));
      setLoadingId(null);
    }
  };

  const tap = (chip: ChipItem) => {
    if (selectedId === chip.id) return onSelect(null); // deselect the target
    const idx = path.findIndex((p) => p.id === chip.id);
    if (idx >= 0) return setPath(path.slice(0, idx)); // collapse this level
    if (chip.hasChildren) void expand(chip);
    else onSelect(chip); // leaf → commit
  };

  // the active spine: the expanded chain + the deepest revealed row. Anything
  // else dims once you've drilled in.
  const lastParent = path[path.length - 1];
  const lastRow = lastParent ? (childrenByParent[lastParent.id] ?? []) : [];
  const active = new Set([...path.map((p) => p.id), ...lastRow.map((k) => k.id)]);
  const isDim = (id: string) => path.length > 0 && !active.has(id) && id !== selectedId;

  const renderChip = (chip: ChipItem, prefix?: string) => (
    <button
      key={chip.id}
      type="button"
      onClick={() => tap(chip)}
      className={cn(
        'border-border text-muted-foreground shrink-0 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap transition-opacity',
        selectedId === chip.id && 'border-primary text-foreground ring-primary/30 ring-1',
        path.some((p) => p.id === chip.id) && selectedId !== chip.id && 'border-foreground/40',
        isDim(chip.id) && 'opacity-35'
      )}
    >
      {prefix}
      {chip.icon && <span className="mr-1">{chip.icon}</span>}
      {chip.title}
    </button>
  );

  const renderTier = (label: string, chips: ChipItem[]) =>
    chips.length === 0 ? null : (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-16 shrink-0 text-[10px] tracking-wide uppercase">
          {label}
        </span>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">{chips.map((c) => renderChip(c))}</div>
      </div>
    );

  return (
    <div className="flex flex-col gap-1.5">
      {renderTier('Favorites', tiers.favorites)}
      {renderTier('Ongoing', tiers.ongoing)}
      {renderTier('Rooms', tiers.topLevel)}

      {/* revealed rows, one per expanded level: "→ room" self-chip then kids */}
      {path.map((parent) => (
        <div key={parent.id} className="flex items-center gap-2 pl-16">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {renderChip(parent, '→ ')}
            {loadingId === parent.id ? (
              <span className="text-muted-foreground px-2 text-xs">…</span>
            ) : (
              (childrenByParent[parent.id] ?? []).map((chip) => renderChip(chip))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
