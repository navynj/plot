/** Pure budget arithmetic for the editor's live footer (A''): the monthly
 *  total is an independent top-down target, so allocations may exceed it — the
 *  gap is the point. `over` is true when allocated > total. Shared by the
 *  client editor and its unit test so the over case is pinned. */
export function summarizeBudget(
  total: number | null,
  allocations: number[]
): { allocated: number; remaining: number; over: boolean } {
  const allocated = allocations.reduce((sum, a) => sum + (Number.isFinite(a) ? a : 0), 0);
  const remaining = (total ?? 0) - allocated;
  return { allocated, remaining, over: remaining < 0 };
}
