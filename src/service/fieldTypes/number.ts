import { FieldTypeMismatchError } from '../errors';
import { registerFieldType } from '../fieldRegistry';

registerFieldType('number', {
  valueColumn: 'numberValue',
  parse(raw, def) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      throw new FieldTypeMismatchError(def.key, 'number', typeof raw);
    }
    const n = Number(raw);
    if (Number.isNaN(n)) throw new FieldTypeMismatchError(def.key, 'number', String(raw));
    return n;
  },
});
