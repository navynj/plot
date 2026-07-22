import { registerFieldType } from '../fieldRegistry';

import { parseDurationMinutes } from './durationParse';

// stored as MINUTES in numberValue — sums/avgs work with no engine change.
// accepts "8:30" (HH:MM), "8h 30m" / "45m" / "8h", or plain minutes.
registerFieldType('duration', {
  valueColumn: 'numberValue',
  parse: (raw, def) => parseDurationMinutes(raw, def.key),
});
