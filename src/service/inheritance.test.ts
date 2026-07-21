import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FieldDef, Node } from '@/db/schema';
import { nodeRepo } from '@/repository/nodeRepo';

import { resolveSchema } from './inheritance';

vi.mock('@/repository/nodeRepo', () => ({
  nodeRepo: { byId: vi.fn() },
}));

const schemaX: FieldDef[] = [{ key: 'x', label: 'X', type: 'text' }];
const schemaY: FieldDef[] = [{ key: 'y', label: 'Y', type: 'number' }];

// A (childSchema X) ── B (childSchema Y) ── C
const grandparent = { id: 'A', parentId: null, childSchema: schemaX } as Node;
const parent = { id: 'B', parentId: 'A', childSchema: schemaY } as Node;
const child = { id: 'C', parentId: 'B', childSchema: [] } as unknown as Node;

function stubTree(nodes: Node[]) {
  vi.mocked(nodeRepo.byId).mockImplementation(async (_userId, id) => {
    return nodes.find((n) => n.id === id) ?? null;
  });
}

describe('inheritance.resolveSchema — depth-1, snapshot semantics (CLAUDE.md §3)', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.byId).mockReset();
  });

  it('(a) depth-1: a node wears exactly its direct parent’s childSchema; the grandparent’s is invisible', async () => {
    stubTree([grandparent, parent, child]);

    const worn = await resolveSchema('u1', child);

    expect(worn).toEqual(schemaY);
    expect(worn.some((d) => d.key === 'x')).toBe(false); // no ancestor leak
    // resolution is ONE read of the direct parent — never walks to A
    expect(nodeRepo.byId).toHaveBeenCalledTimes(1);
    expect(nodeRepo.byId).toHaveBeenCalledWith('u1', 'B');
  });

  it('(b) snapshot: editing an ancestor’s schema later does not change what an inherit-mode descendant’s children wear', async () => {
    // B was inserted with `inherit`: its childSchema is a COPY of A's at insert time
    const snapshotOfA: FieldDef[] = [{ key: 'orig', label: 'Original', type: 'text' }];
    const inheritB = {
      id: 'B',
      parentId: 'A',
      childSchema: snapshotOfA,
      schemaMode: 'inherit',
    } as Node;
    // A's schema was edited AFTER the insertion
    const editedA = {
      id: 'A',
      parentId: null,
      childSchema: [{ key: 'edited', label: 'Edited later', type: 'text' }],
    } as Node;
    stubTree([editedA, inheritB, child]);

    const worn = await resolveSchema('u1', child);

    expect(worn).toEqual(snapshotOfA); // still the copy taken at insert time
    expect(worn.some((d) => d.key === 'edited')).toBe(false);
    // never resolves THROUGH the inherit node up to A — schemaMode is ignored on read
    expect(nodeRepo.byId).not.toHaveBeenCalledWith('u1', 'A');
  });

  it('(c) a parentless node resolves to an empty schema without touching the repo', async () => {
    stubTree([grandparent]);

    expect(await resolveSchema('u1', grandparent)).toEqual([]);
    expect(nodeRepo.byId).not.toHaveBeenCalled();
  });

  it('a vanished (deleted) parent resolves to an empty schema, not an error', async () => {
    stubTree([]);
    expect(await resolveSchema('u1', child)).toEqual([]);
  });

  it('(A1) an ATTACHED child wears nothing — the one depth-1 exception — without touching the parent', async () => {
    stubTree([grandparent, parent, child]);
    const attachedChild = { id: 'C', parentId: 'B', attached: true } as unknown as Node;

    expect(await resolveSchema('u1', attachedChild)).toEqual([]);
    // never reads the parent: the exception short-circuits before the fetch
    expect(nodeRepo.byId).not.toHaveBeenCalled();
  });
});
