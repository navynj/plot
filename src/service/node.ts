import type { Node } from '@/db/schema';
import { nodeRepo, type UpdateNodePatch } from '@/repository/nodeRepo';

import { EmptyCaptureError, NodeNotFoundError } from './errors';

export interface CaptureInput {
  title?: string;
  body?: string;
}

/**
 * Raw means raw (DESIGN §6-capture): a captured node is title/body + capturedAt
 * only. No parent (stays in the inbox filter), no field values, no childSchema.
 * Structure arrives later via field triage (Phase 2) and position triage (Phase 3).
 */
export async function captureNode(userId: string, input: CaptureInput): Promise<Node> {
  const title = input.title?.trim() || null;
  const body = input.body?.trim() || null;
  if (!title && !body) {
    throw new EmptyCaptureError();
  }
  return nodeRepo.create({ userId, title, body, capturedAt: new Date() });
}

export async function updateNode(id: string, patch: UpdateNodePatch): Promise<Node> {
  const updated = await nodeRepo.update(id, patch);
  if (!updated) {
    throw new NodeNotFoundError(id);
  }
  return updated;
}

export async function deleteNode(id: string): Promise<void> {
  const deleted = await nodeRepo.softDelete(id);
  if (!deleted) {
    throw new NodeNotFoundError(id);
  }
}

export function getTimeline(userId: string): Promise<Node[]> {
  return nodeRepo.findTimeline(userId);
}

export function getInbox(userId: string): Promise<Node[]> {
  return nodeRepo.findInbox(userId);
}
