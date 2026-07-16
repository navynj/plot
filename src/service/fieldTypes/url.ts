import { FieldTypeMismatchError } from '../errors';
import { registerFieldType } from '../fieldRegistry';

registerFieldType('url', {
  valueColumn: 'textValue',
  parse(raw, def) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string') throw new FieldTypeMismatchError(def.key, 'url', typeof raw);
    try {
      new URL(raw);
    } catch {
      throw new FieldTypeMismatchError(def.key, 'url', raw);
    }
    return raw;
  },
});
