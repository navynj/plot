import type { Link, Node } from '@/db/schema';
import { rankBetween, spreadRanks } from '@/lib/rank';
import { linkRepo } from '@/repository/linkRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { describeCandidates, type NodeCandidate } from './candidates';
import { NodeNotFoundError, SelfLinkError } from './errors';

/**
 * Curation (DESIGN §2): the second attachment kind. A link NEVER inherits and
 * NEVER touches position — membership changes no parentId, no node rank, no
 * resolved schema. A node can sit in many collections at once. No cycle
 * concerns (this is a graph); the only structural rule is no self-links.
 */

export async function addToCollection(
  userId: string,
  collectionId: string,
  memberId: string
): Promise<Link> {
  if (collectionId === memberId) throw new SelfLinkError(collectionId);

  const edges = await linkRepo.findEdges(userId, collectionId);
  const last = edges[edges.length - 1]?.rank ?? null;
  const rank = (last === null ? spreadRanks(1)[0]! : rankBetween(last, null)) ?? spreadRanks(1)[0]!;

  const created = await linkRepo.create(userId, collectionId, memberId, rank);
  if (!created) throw new NodeNotFoundError(memberId);
  return created;
}

export async function removeFromCollection(
  userId: string,
  collectionId: string,
  memberId: string
): Promise<void> {
  const removed = await linkRepo.remove(userId, collectionId, memberId);
  if (!removed) throw new NodeNotFoundError(memberId);
}

/** The collection's linked members, in curation order. */
export function getMembers(userId: string, collectionId: string): Promise<Node[]> {
  return linkRepo.findTargets(userId, collectionId);
}

/** The collections a node sits in. */
export function getMemberships(userId: string, nodeId: string): Promise<Node[]> {
  return linkRepo.findSources(userId, nodeId);
}

/** Anything can be a collection: every node except the node itself and the
 *  collections it already sits in. */
export async function getCollectionCandidates(
  userId: string,
  nodeId: string
): Promise<NodeCandidate[]> {
  const [all, memberships] = await Promise.all([
    nodeRepo.findTimeline(userId),
    linkRepo.findSources(userId, nodeId),
  ]);
  const excluded = new Set<string>([nodeId, ...memberships.map((m) => m.id)]);
  return describeCandidates(all, excluded);
}
