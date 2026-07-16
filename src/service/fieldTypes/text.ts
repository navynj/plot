import { FieldTypeMismatchError } from '../errors';
import { registerFieldType } from '../fieldRegistry';

registerFieldType('text', {
  valueColumn: 'textValue',
  parse(raw, def) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string') throw new FieldTypeMismatchError(def.key, 'text', typeof raw);
    return raw;
  },
});
