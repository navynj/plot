import { Input } from '@/components/ui/input';

import { ScalePicker } from '../ScalePicker';
import { registerFieldUI } from '../registry';

const format = new Intl.NumberFormat();

/** points on a fully-constrained scale, or null when unconstrained/too many */
function scalePoints(def: {
  min?: number;
  max?: number;
  step?: number;
}): { min: number; max: number; step: number } | null {
  const { min, max, step } = def;
  if (min === undefined || max === undefined || step === undefined || step <= 0) return null;
  const count = (max - min) / step + 1;
  return count <= 11 ? { min, max, step } : null;
}

registerFieldUI('number', {
  render: ({ value }) => (typeof value === 'number' ? format.format(value) : null),
  edit: ({ def, value }) => {
    const scale = scalePoints(def);
    if (scale) {
      // small fully-constrained range → the segmented scale picker.
      // Same type, same storage; only the editor differs.
      return (
        <ScalePicker
          name={def.key}
          min={scale.min}
          max={scale.max}
          step={scale.step}
          value={typeof value === 'number' ? value : undefined}
        />
      );
    }
    // a TEXT input (not type=number, which blocks + * ( ) ): the field accepts
    // an arithmetic expression (1200*3) and stores the evaluated result. Entry
    // correctness over the native spinner; constraints validate server-side.
    return (
      <Input
        type="text"
        inputMode="text"
        autoComplete="off"
        name={def.key}
        placeholder="number or 1200*3"
        defaultValue={typeof value === 'number' ? value : undefined}
      />
    );
  },
});
