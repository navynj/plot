import { describe, expect, it } from 'vitest';

import { formatTimestamp } from './formatTimestamp';

describe('formatTimestamp — renders on the user timezone', () => {
  // 02:30 UTC on 7/22 is 19:30 the PREVIOUS day in Vancouver (PDT, UTC-7)
  const instant = new Date('2026-07-22T02:30:00Z');

  it('formats in the given tz, not the runtime zone', () => {
    const vancouver = formatTimestamp(instant, 'America/Vancouver');
    const utc = formatTimestamp(instant, 'UTC');
    expect(vancouver).toMatch(/Jul 21, 2026/);
    expect(vancouver).toMatch(/7:30\s?PM/);
    expect(utc).toMatch(/Jul 22, 2026/);
    expect(utc).toMatch(/2:30\s?AM/);
    expect(vancouver).not.toBe(utc);
  });

  it('the same tz round-trips consistently (cached formatter)', () => {
    expect(formatTimestamp(instant, 'America/Vancouver')).toBe(
      formatTimestamp(instant, 'America/Vancouver')
    );
  });
});
