import { describe, expect, it } from 'vitest';

import { createSerialGate } from './serialize';

/** The exactly-once pin behind every tap-commit path: bulk move, delete
 *  confirm, create-in-place, and undo/redo hammering (toast tap + Ctrl+Z). */
describe('createSerialGate — exactly-once under hammering', () => {
  it('drops overlapping calls: five hammered taps run the action once', async () => {
    const gate = createSerialGate();
    let runs = 0;
    let release!: () => void;
    const settled = new Promise<void>((r) => (release = r));
    const action = async () => {
      runs += 1;
      await settled;
      return 'applied';
    };

    const first = gate(action);
    const hammered = [gate(action), gate(action), gate(action), gate(action)];
    expect(await Promise.all(hammered)).toEqual([undefined, undefined, undefined, undefined]);
    expect(runs).toBe(1); // dropped synchronously, before the first settles

    release();
    expect(await first).toBe('applied');
    expect(runs).toBe(1);
  });

  it('reopens after settling: sequential calls each run', async () => {
    const gate = createSerialGate();
    let runs = 0;
    await gate(async () => void (runs += 1));
    await gate(async () => void (runs += 1));
    expect(runs).toBe(2);
  });

  it('a failure releases the gate (no stuck lock) and propagates the error', async () => {
    const gate = createSerialGate();
    await expect(
      gate(async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(await gate(async () => 'recovered')).toBe('recovered');
  });

  it('one gate serializes ACROSS different actions — undo and redo share a stack, so an undo in flight drops a redo tap', async () => {
    const gate = createSerialGate();
    let undos = 0;
    let redos = 0;
    let release!: () => void;
    const settled = new Promise<void>((r) => (release = r));

    const undoing = gate(async () => {
      undos += 1;
      await settled;
      return 'undone';
    });
    expect(await gate(async () => void (redos += 1))).toBeUndefined();
    release();
    await undoing;
    expect(undos).toBe(1);
    expect(redos).toBe(0);
  });
});
