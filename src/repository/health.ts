import { count } from 'drizzle-orm';

import { db } from '@/db';
import { node } from '@/db/schema';

export async function countNodes(): Promise<number> {
  const rows = await db.select({ value: count() }).from(node);
  return rows[0]?.value ?? 0;
}
