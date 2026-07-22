'use client';

import { CopyPlus, Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { loadBudgetMonthAction, saveBudgetAction } from '@/app/node/[id]/actions';
import { usePendingLock } from '@/components/hooks/usePendingLock';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { summarizeBudget } from '@/lib/budgetMath';

export interface BudgetEditorRowData {
  categoryId: string;
  name: string;
  icon: string | null;
  allocation: number | null;
  actual: number;
}

const fmt = new Intl.NumberFormat();
// actual spending keeps its decimals (Canadian amounts like 6.99) — never
// rounded, unlike the whole-won budget targets
const fmtActual = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const parseNum = (s: string): number | null => {
  const t = s.replace(/,/g, '').trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** The During-style budget editor: one form editing the month's total + every
 *  category allocation at once, with live sum and over/remaining. The total
 *  is a top-down target INDEPENDENT of the allocation sum — over-allocation is
 *  shown (red), never blocked. Save commits the whole form (total first, then
 *  lines, server-side). "Copy from previous month" prefills the inputs. */
export function BudgetEditor({
  budgetId,
  month,
  prevMonth,
  prevMonthLabel,
  total: initialTotal,
  rows,
}: {
  budgetId: string;
  month: string;
  prevMonth: string;
  prevMonthLabel: string;
  total: number | null;
  rows: BudgetEditorRowData[];
}) {
  const [total, setTotal] = React.useState(initialTotal === null ? '' : String(initialTotal));
  const [allocs, setAllocs] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.categoryId, r.allocation === null ? '' : String(r.allocation)]))
  );
  const { pending: copying, run: runCopy } = usePendingLock();

  const { allocated: allocSum, remaining, over } = summarizeBudget(
    parseNum(total),
    rows.map((r) => parseNum(allocs[r.categoryId] ?? '') ?? 0)
  );

  const copyPrevious = () =>
    runCopy('copy', async () => {
      const data = await loadBudgetMonthAction(budgetId, prevMonth);
      setTotal(data.total === null ? '' : String(data.total));
      setAllocs(
        Object.fromEntries(
          rows.map((r) => [r.categoryId, data.allocations[r.categoryId] != null ? String(data.allocations[r.categoryId]) : ''])
        )
      );
      const n = Object.keys(data.allocations).length;
      toast(n === 0 && data.total === null ? `Nothing budgeted in ${prevMonthLabel}` : `Filled from ${prevMonthLabel}`);
    });

  return (
    <form action={saveBudgetAction.bind(null, budgetId, month)} className="flex flex-col gap-4">
      {/* top: the month's total budget, directly editable */}
      <div className="border-border flex items-center justify-between gap-3 rounded-lg border p-4">
        <label htmlFor="total" className="text-sm font-medium">
          Total budget
        </label>
        <Input
          id="total"
          name="total"
          inputMode="numeric"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder="0"
          className="w-40 text-right tabular-nums"
        />
      </div>

      {/* every category as a row: allocation editable, actual beside it */}
      <div className="border-border divide-border divide-y rounded-lg border">
        <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2 text-xs">
          <span>Category</span>
          <span className="w-28 text-right">Target</span>
          <span className="w-24 text-right">Actual</span>
        </div>
        {rows.map((r) => {
          const alloc = parseNum(allocs[r.categoryId] ?? '') ?? 0;
          const rowOver = r.actual > alloc && alloc > 0;
          return (
            <div
              key={r.categoryId}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2"
            >
              <span className="truncate text-sm">
                {r.icon && <span className="mr-1.5">{r.icon}</span>}
                {r.name}
              </span>
              <Input
                name={`alloc:${r.categoryId}`}
                inputMode="numeric"
                value={allocs[r.categoryId] ?? ''}
                onChange={(e) =>
                  setAllocs((a) => ({ ...a, [r.categoryId]: e.target.value }))
                }
                placeholder="—"
                aria-label={`${r.name} target`}
                className="w-28 text-right text-sm tabular-nums"
              />
              <span
                className={`w-24 text-right text-sm tabular-nums ${rowOver ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {fmtActual.format(r.actual)}
              </span>
            </div>
          );
        })}
      </div>

      {/* live footer: sum of allocations, and total − sum (over/remaining) */}
      <div className="flex flex-col gap-1 px-1 text-sm tabular-nums">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Allocated</span>
          <span>{fmt.format(Math.round(allocSum))}</span>
        </div>
        <div className={`flex justify-between font-medium ${over ? 'text-destructive' : ''}`}>
          <span>{over ? 'Over target' : 'Remaining'}</span>
          <span>
            {over ? '−' : ''}
            {fmt.format(Math.round(Math.abs(remaining)))}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SubmitButton>Save</SubmitButton>
        <Button type="button" variant="outline" disabled={copying} onClick={copyPrevious}>
          {copying ? <Loader2 className="size-3.5 animate-spin" /> : <CopyPlus className="size-3.5" />}
          Copy from {prevMonthLabel}
        </Button>
      </div>
    </form>
  );
}
