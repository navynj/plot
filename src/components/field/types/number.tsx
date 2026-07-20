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
    return (
      <Input
        type="number"
        step={def.step ?? 'any'}
        min={def.min}
        max={def.max}
        name={def.key}
        defaultValue={typeof value === 'number' ? value : undefined}
      />
    );
  },
});
