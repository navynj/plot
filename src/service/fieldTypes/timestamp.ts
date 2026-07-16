import { FieldTypeMismatchError } from '../errors';
import { registerFieldType } from '../fieldRegistry';

registerFieldType('timestamp', {
  valueColumn: 'dateValue',
  parse(raw, def) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string' && !(raw instanceof Date)) {
      throw new FieldTypeMismatchError(def.key, 'timestamp', typeof raw);
    }
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new FieldTypeMismatchError(def.key, 'timestamp', String(raw));
    }
    return d;
  },
});
