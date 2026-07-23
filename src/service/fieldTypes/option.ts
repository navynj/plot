import { FieldTypeMismatchError } from '../errors';
import { registerFieldType } from '../fieldRegistry';

registerFieldType('option', {
  valueColumn: 'textValue',
  parse(raw, def) {
    if (raw == null || raw === '') return null;

    // multi-select: accept an array or the comma-joined string the UI submits.
    // Every chosen value must be a declared option; dedupe; store comma-joined
    // (option choices can't contain commas — the choices editor splits on them).
    if (def.multiple) {
      const values = (Array.isArray(raw) ? raw : String(raw).split(','))
        .map((v) => (typeof v === 'string' ? v.trim() : String(v)))
        .filter((v) => v !== '');
      const seen = new Set<string>();
      const chosen: string[] = [];
      for (const v of values) {
        if (def.options && !def.options.includes(v)) {
          throw new FieldTypeMismatchError(def.key, `one of [${def.options.join(', ')}]`, v);
        }
        if (!seen.has(v)) {
          seen.add(v);
          chosen.push(v);
        }
      }
      return chosen.length === 0 ? null : chosen.join(',');
    }

    if (typeof raw !== 'string') throw new FieldTypeMismatchError(def.key, 'option', typeof raw);
    if (def.options && !def.options.includes(raw)) {
      throw new FieldTypeMismatchError(def.key, `one of [${def.options.join(', ')}]`, raw);
    }
    return raw;
  },
});
