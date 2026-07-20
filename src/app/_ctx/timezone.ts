import { cookies } from 'next/headers';

import { resolveTimezone } from '@/lib/day';

/** Entry-point helper (CLAUDE.md §1): the timezone is request context, like
 *  the session — resolved here from the tz cookie (client-detected, see
 *  TimezoneSync) and passed DOWN as a parameter. Services never read cookies.
 *  Absent/invalid cookie falls back to Asia/Seoul. */
export async function getRequestTimezone(): Promise<string> {
  return resolveTimezone((await cookies()).get('tz')?.value);
}
