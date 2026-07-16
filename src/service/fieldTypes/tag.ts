import { FieldTypeMismatchError } from '../errors';
import { registerFieldType } from '../fieldRegistry';

// free multi-value label; stored this phase as a comma-separated textValue
registerFieldType('tag', {
  valueColumn: 'textValue',
  parse(raw, def) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string') throw new FieldTypeMismatchError(def.key, 'tag', typeof raw);
    return raw;
  },
});
