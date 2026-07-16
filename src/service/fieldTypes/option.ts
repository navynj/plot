import { FieldTypeMismatchError } from '../errors';
import { registerFieldType } from '../fieldRegistry';

registerFieldType('option', {
  valueColumn: 'textValue',
  parse(raw, def) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string') throw new FieldTypeMismatchError(def.key, 'option', typeof raw);
    if (def.options && !def.options.includes(raw)) {
      throw new FieldTypeMismatchError(def.key, `one of [${def.options.join(', ')}]`, raw);
    }
    return raw;
  },
});
