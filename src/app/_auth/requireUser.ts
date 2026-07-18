import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { ensureSeed } from '@/service/seed';

/** Entry-point helper (CLAUDE.md §1): resolves the session here, at the app
 *  layer, and hands a plain `userId` down. Services and repositories never
 *  read the session — they take this value as a parameter.
 *
 *  First authenticated visit runs the one-time seed (one limit-1 query on
 *  every later request) and lands the user on the grid home, where the
 *  seeded rooms are visible instead of a blank stream. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect('/signin');
  }
  if (await ensureSeed(userId)) {
    redirect('/grid');
  }
  return userId;
}
