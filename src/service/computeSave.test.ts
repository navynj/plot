import { beforeEach, describe, expect, it, vi } from 'vitest';

import '@/service/fieldTypes';

import type { FieldDef, FieldValue, Node } from '@/db/schema';
import { fieldValueRepo } from '@/repository/fieldValueRepo';
import { nodeRepo } from '@/repository/nodeRepo';

import { ValidationError } from './errors';
import { saveOwnValues } from './field';

vi.mock('@/repository/nodeRepo', () => ({ nodeRepo: { byId: vi.fn() } }));
vi.mock('@/repository/fieldValueRepo', () => ({
  fieldValueRepo: { upsert: vi.fn(), readByNode: vi.fn(), deleteByKey: vi.fn() },
}));

const schema: FieldDef[] = [
  { key: 'sleepAt', label: 'Sleep at', type: 'timestamp' },
  {
    key: 'wakeUpAt',
    label: 'Wake up at',
    type: 'timestamp',
    validate: [{ op: 'gt', otherField: 'sleepAt' }],
  },
  { key: 'duration', label: 'Duration', type: 'computed', compute: { from: 'sleepAt', to: 'wakeUpAt' } },
];
const parent = { id: 'P', parentId: null, childSchema: schema } as Node;
const child = { id: 'C', parentId: 'P', attached: false, childSchema: [] } as unknown as Node;

/** a stored field_value row with only its dateValue populated */
const dateRow = (key: string, iso: string): FieldValue =>
  ({
    id: `fv-${key}`,
    nodeId: 'C',
    key,
    textValue: null,
    numberValue: null,
    boolValue: null,
    dateValue: new Date(iso),
    linkValue: null,
  }) as FieldValue;

describe('saveOwnValues — computed field compute rule (Sleep duration)', () => {
  beforeEach(() => {
    vi.mocked(nodeRepo.byId)
      .mockReset()
      .mockImplementation(async (_u, id) => [child, parent].find((n) => n.id === id) ?? null);
    vi.mocked(fieldValueRepo.upsert).mockReset().mockResolvedValue({ id: 'fv' } as never);
    vi.mocked(fieldValueRepo.deleteByKey).mockReset().mockResolvedValue(true);
    vi.mocked(fieldValueRepo.readByNode).mockReset().mockResolvedValue([]);
  });

  it('both sources present computes duration in minutes, overriding the (empty) manual input', async () => {
    await saveOwnValues('u1', 'C', {
      sleepAt: '2026-07-23T00:00',
      wakeUpAt: '2026-07-23T06:30',
      duration: '',
    });
    expect(fieldValueRepo.upsert).toHaveBeenCalledWith('u1', 'C', 'duration', {
      column: 'numberValue',
      value: 390,
    });
  });

  it('editing one source recomputes against the stored other source (even unedited)', async () => {
    vi.mocked(fieldValueRepo.readByNode).mockResolvedValue([dateRow('wakeUpAt', '2026-07-23T06:00')]);
    // partial form: only sleepAt is rendered/edited
    await saveOwnValues('u1', 'C', { sleepAt: '2026-07-23T01:00' }, ['sleepAt']);
    expect(fieldValueRepo.upsert).toHaveBeenCalledWith('u1', 'C', 'duration', {
      column: 'numberValue',
      value: 300,
    });
  });

  it('a missing source honors the manual duration value', async () => {
    await saveOwnValues('u1', 'C', { sleepAt: '2026-07-23T01:00', duration: '8:00' }, [
      'sleepAt',
      'duration',
    ]);
    expect(fieldValueRepo.upsert).toHaveBeenCalledWith('u1', 'C', 'duration', {
      column: 'numberValue',
      value: 480,
    });
  });

  it('rejects an inverted pair via validation BEFORE computing or persisting anything', async () => {
    await expect(
      saveOwnValues('u1', 'C', {
        sleepAt: '2026-07-23T08:00',
        wakeUpAt: '2026-07-23T06:00',
        duration: '',
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fieldValueRepo.upsert).not.toHaveBeenCalled();
    expect(fieldValueRepo.deleteByKey).not.toHaveBeenCalled();
  });
});
