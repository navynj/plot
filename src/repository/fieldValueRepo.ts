import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { fieldValue, node, type FieldValue, type TypedFieldWrite } from '@/db/schema';

/** field_value has no user column; ownership is enforced through the owning
 *  node, in SQL, on every method — same guarantee as nodeRepo. */
async function ownsNode(userId: string, nodeId: string): Promise<boolean> {
  const rows = await db
    .select({ id: node.id })
    .from(node)
    .where(and(eq(node.id, nodeId), eq(node.userId, userId), isNull(node.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

/** All typed columns nulled; the write's column is then set — an upsert that
 *  changes a field's type must clear the previously used column. */
function toColumnValues(write: TypedFieldWrite) {
  const values = {
    textValue: null as string | null,
    numberValue: null as string | null, // numeric column: Drizzle takes strings
    boolValue: null as boolean | null,
    dateValue: null as Date | null,
    linkValue: null as string | null,
  };
  switch (write.column) {
    case 'textValue':
      values.textValue = write.value;
      break;
    case 'numberValue':
      values.numberValue = String(write.value);
      break;
    case 'boolValue':
      values.boolValue = write.value;
      break;
    case 'dateValue':
      values.dateValue = write.value;
      break;
    case 'linkValue':
      values.linkValue = write.value;
      break;
  }
  return values;
}

export const fieldValueRepo = {
  /** Upsert on the (nodeId, key) unique pair. Returns null when the node is
   *  not owned by `userId` (or does not exist). */
  async upsert(
    userId: string,
    nodeId: string,
    key: string,
    write: TypedFieldWrite
  ): Promise<FieldValue | null> {
    if (!(await ownsNode(userId, nodeId))) return null;
    const values = toColumnValues(write);
    const rows = await db
      .insert(fieldValue)
      .values({ nodeId, key, ...values })
      .onConflictDoUpdate({
        target: [fieldValue.nodeId, fieldValue.key],
        set: values,
      })
      .returning();
    return rows[0] ?? null;
  },

  async readByNode(userId: string, nodeId: string): Promise<FieldValue[]> {
    const rows = await db
      .select({ fv: fieldValue })
      .from(fieldValue)
      .innerJoin(node, eq(node.id, fieldValue.nodeId))
      .where(and(eq(fieldValue.nodeId, nodeId), eq(node.userId, userId), isNull(node.deletedAt)));
    return rows.map((r) => r.fv);
  },

  /** Clears a field. Returns false only when the node is not owned; clearing
   *  an already-empty field is a legal no-op. */
  async deleteByKey(userId: string, nodeId: string, key: string): Promise<boolean> {
    if (!(await ownsNode(userId, nodeId))) return false;
    await db.delete(fieldValue).where(and(eq(fieldValue.nodeId, nodeId), eq(fieldValue.key, key)));
    return true;
  },
};
