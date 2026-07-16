import { redirect } from 'next/navigation';

import { auth } from '@/auth';

/** Entry-point helper (CLAUDE.md §1): resolves the session here, at the app
 *  layer, and hands a plain `userId` down. Services and repositories never
 *  read the session — they take this value as a parameter. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect('/signin');
  }
  return userId;
}
