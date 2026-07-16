import { FieldTypeMismatchError } from '../errors';
import { registerFieldType } from '../fieldRegistry';

// references another node; target existence/ownership is checked in
// service/field (it needs the repo, which a pure parse cannot reach)
registerFieldType('link', {
  valueColumn: 'linkValue',
  parse(raw, def) {
    if (raw == null || raw === '') return null;
    if (typeof raw !== 'string') throw new FieldTypeMismatchError(def.key, 'link', typeof raw);
    return raw;
  },
});
