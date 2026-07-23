'use client';

import * as React from 'react';

import { chipChildren } from '@/app/actions';
import type { CaptureChipTiers, ChipItem } from '@/service/node';
import { cn } from '@/lib/utils';

/**
 * B2 three-tier capture chips with recursive drill-down.
 *
 * Tiers: Favorites, Ongoing, Top-level (confirmed roots). Selection and drilling
 * are DECOUPLED (fixing the B1/B2 collision where a node with children could not
 * be picked):
 *  - Tapping ANY chip always SELECTS it as the capture parent — regardless of
 *    whether it has children — so B1's inline fields appear immediately and the
 *    captured node actually lands under it.
 *  - If the selected node has DRILLABLE children (child rooms that themselves
 *    have children), those reveal in a row below and unrelated chips dim. This
 *    is an addition to the selection, never a replacement — selection stays on
 *    the tapped node; the reveal just says "you can go deeper."
 *  - Leaves (a node's individual record-children) never appear as chips. So
 *    tapping Expense selects it and shows only its sub-rooms — not its dozens of
 *    expense logs. Attached appendages are excluded too (service-side).
 *  - Tapping a revealed child selects it (fields switch) and reveals its own
 *    drillable children in turn. Re-tapping the selection deselects + collapses.
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
  // the revealed drill spine: each entry renders a row of its drillable children
  const [path, setPath] = React.useState<ChipItem[]>([]);
  const [childrenByParent, setChildrenByParent] = React.useState<Record<string, ChipItem[]>>({});
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  /** Reveal `chip`'s drillable children below `base` (its ancestor spine). A
   *  node with no children at all can't drill; one whose children are all leaves
   *  drills to an empty set and simply shows no row. Selection is unaffected. */
  const reveal = async (base: ChipItem[], chip: ChipItem) => {
    if (!chip.hasChildren) return setPath(base); // no children → no drill row
    const cached = childrenByParent[chip.id];
    if (cached !== undefined) {
      return setPath(cached.length > 0 ? [...base, chip] : base);
    }
    setPath([...base, chip]); // optimistic: show the row with a loader
    setLoadingId(chip.id);
    const kids = await chipChildren(chip.id);
    setChildrenByParent((m) => ({ ...m, [chip.id]: kids }));
    setLoadingId(null);
    if (kids.length === 0) setPath((cur) => cur.filter((p) => p.id !== chip.id));
  };

  const tap = (chip: ChipItem, parentChip: ChipItem | null) => {
    // the ancestor spine above this chip: the path up to and including its row's
    // parent (empty for a tier chip)
    const base = parentChip
      ? path.slice(0, path.findIndex((p) => p.id === parentChip.id) + 1)
      : [];
    if (selectedId === chip.id) {
      onSelect(null); // re-tap the selection → deselect and collapse its row
      setPath(base);
      return;
    }
    onSelect(chip); // ALWAYS select — this is the fix
    void reveal(base, chip);
  };

  // the active spine (not dimmed): every revealed parent + every revealed child
  // + the current selection. Unrelated chips dim once you've drilled in.
  const revealed = path.flatMap((p) => childrenByParent[p.id] ?? []);
  const active = new Set([...path.map((p) => p.id), ...revealed.map((c) => c.id)]);
  const isDim = (id: string) => path.length > 0 && !active.has(id) && id !== selectedId;

  const renderChip = (chip: ChipItem, parentChip: ChipItem | null) => (
    <button
      key={chip.id}
      type="button"
      onClick={() => tap(chip, parentChip)}
      className={cn(
        'border-border text-muted-foreground shrink-0 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap transition-opacity',
        selectedId === chip.id && 'border-primary text-foreground ring-primary/30 ring-1',
        path.some((p) => p.id === chip.id) && selectedId !== chip.id && 'border-foreground/40',
        isDim(chip.id) && 'opacity-35'
      )}
    >
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
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {chips.map((c) => renderChip(c, null))}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-1.5">
      {renderTier('Favorites', tiers.favorites)}
      {renderTier('Ongoing', tiers.ongoing)}
      {renderTier('Rooms', tiers.topLevel)}

      {/* revealed rows, one per drilled level: only drillable children, no
          "→ this room" self-chip (tapping the room already selected it) */}
      {path.map((parent) => (
        <div key={parent.id} className="flex items-center gap-2 pl-16">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {loadingId === parent.id ? (
              <span className="text-muted-foreground px-2 text-xs">…</span>
            ) : (
              (childrenByParent[parent.id] ?? []).map((chip) => renderChip(chip, parent))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
