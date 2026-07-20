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
    // constraints are SERVICE-validated regardless of UI (a bypassed editor
    // still cannot store out-of-range/off-step values)
    if (def.min !== undefined && n < def.min) {
      throw new FieldTypeMismatchError(def.key, `a number ≥ ${def.min}`, String(n));
    }
    if (def.max !== undefined && n > def.max) {
      throw new FieldTypeMismatchError(def.key, `a number ≤ ${def.max}`, String(n));
    }
    if (def.step !== undefined && def.step > 0) {
      const base = def.min ?? 0;
      const steps = (n - base) / def.step;
      if (Math.abs(steps - Math.round(steps)) > 1e-9) {
        throw new FieldTypeMismatchError(def.key, `steps of ${def.step} from ${base}`, String(n));
      }
    }
    return n;
  },
});
