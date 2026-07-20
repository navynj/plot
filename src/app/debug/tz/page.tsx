import { cookies } from 'next/headers';

import { requireUserId } from '@/app/_auth/requireUser';
import { getRequestTimezone } from '@/app/_ctx/timezone';
import { TzClientReadout } from '@/components/TzClientReadout';
import { dayInTz, resolveTimezone, todayInTz } from '@/lib/day';

export const dynamic = 'force-dynamic';

/** Auth-gated three-way timezone readout: what the browser detects, what the
 *  cookie holds, what the server resolved for THIS request. On-device
 *  debugging: just visit /debug/tz. */
export default async function TzDebugPage() {
  await requireUserId();
  const rawValue = (await cookies()).get('tz')?.value;
  const rawCookie = rawValue ?? '(no tz cookie)';
  const decodedValidated =
    rawValue === undefined ? '(nothing to decode)' : resolveTimezone(rawValue);
  const resolved = await getRequestTimezone();
  const now = new Date();

  return (
    <div className="flex flex-col gap-3 py-6 font-mono text-sm">
      <h1 className="font-sans font-semibold">timezone debug</h1>
      <section className="border-border rounded-md border p-3">
        <h2 className="text-muted-foreground font-sans text-xs uppercase">server (this request)</h2>
        <p>raw tz cookie&nbsp;&nbsp;: {rawCookie}</p>
        <p>decoded+valid&nbsp;&nbsp;: {decodedValidated}</p>
        <p>resolved tz&nbsp;&nbsp;&nbsp;&nbsp;: {resolved}</p>
        <p>server today&nbsp;&nbsp;&nbsp;: {todayInTz(resolved)}</p>
        <p>UTC now&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {now.toISOString()}</p>
        <p>Seoul lens day&nbsp;: {dayInTz(now, 'Asia/Seoul')}</p>
      </section>
      <TzClientReadout />
    </div>
  );
}
