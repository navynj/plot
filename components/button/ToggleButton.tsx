import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';

interface ToggleButtonProps extends ClassNameProps {
  checked: boolean;
  onChecked: (checked: boolean) => void;
  checkedText?: string;
  uncheckedText?: string;
}

const ToggleButton = ({
  checked,
  onChecked,
  checkedText,
  uncheckedText,
  className,
}: ToggleButtonProps) => {
  const checkHandler = () => {
    onChecked(!checked);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold">{checked ? checkedText : uncheckedText}</span>
      <button
        type="button"
        className={cn(
          'relative font-extrabold w-8 h-4 text-xs rounded-full shrink-0 transition-all',
          checked ? 'bg-primary' : 'bg-gray-100',
          className
        )}
        onClick={checkHandler}
      >
        <div
          className={cn(
            'absolute bg-white w-3 h-3 rounded-full transition-all',
            checked
              ? 'translate-x-[140%] top-[50%] translate-y-[-50%]'
              : 'translate-x-[20%] top-[50%] translate-y-[-50%]'
          )}
        />
      </button>
    </div>
  );
};

export default ToggleButton;
