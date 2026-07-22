import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireUserId } from '@/app/_auth/requireUser';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import { BudgetEditor } from '@/components/node/BudgetEditor';
import { Button } from '@/components/ui/button';
import { PeriodNavigator } from '@/components/view/PeriodNavigator';
import { isValidMonth, monthLabel, shiftMonth, thisMonthInTz } from '@/lib/day';
import { displayName } from '@/lib/identity';
import { getBudgetEditorData } from '@/service/budget';
import { getNode } from '@/service/node';

export const dynamic = 'force-dynamic';

/** The During-style budget editor screen (A''): one form for the navigated
 *  month — total on top, every category as a row, live over/remaining. Scoped
 *  by the shared period navigator; reached from the Budget node and from the
 *  Expense view's overlay ("Edit budget"). */
export default async function BudgetEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const { period } = await searchParams;
  const userId = await requireUserId();
  const tz = await getRequestTimezone();

  const budget = await getNode(userId, id);
  if (!budget) notFound();

  const thisMonth = thisMonthInTz(tz);
  const month = isValidMonth(period ?? '') ? period! : thisMonth;
  const data = await getBudgetEditorData(userId, id, month, tz);
  // not a budget ledger (no category link + amount + month schema)
  if (!data) notFound();

  const prevMonth = shiftMonth(month, -1);

  return (
    <div className="flex flex-col gap-5 py-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">
            {budget.displayIcon && <span className="mr-1">{budget.displayIcon}</span>}
            {displayName(budget)}
          </h1>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href={`/node/${budget.id}`}>← back</Link>
          </Button>
        </div>
        <PeriodNavigator month={month} thisMonth={thisMonth} basePath={`/node/${budget.id}/budget`} />
      </header>

      <BudgetEditor
        budgetId={id}
        month={month}
        prevMonth={prevMonth}
        prevMonthLabel={monthLabel(prevMonth)}
        total={data.total}
        rows={data.rows}
      />
    </div>
  );
}
