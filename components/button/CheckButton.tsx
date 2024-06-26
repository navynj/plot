import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import { useEffect, useState } from 'react';

interface CheckButtonProps extends ClassNameProps {
  defaultChecked?: boolean;
  onChecked?: (checked: boolean) => void;
  checkedCheckClass?: string;
}

const CheckButton = ({
  defaultChecked,
  onChecked,
  checkedCheckClass,
  className,
}: CheckButtonProps) => {
  const [checked, setChecked] = useState(!!defaultChecked);

  useEffect(() => {
    setChecked(!!defaultChecked);
  }, [defaultChecked]);

  const checkHandler = () => {
    setChecked((prevChecked) => {
      onChecked && onChecked(!prevChecked);
      return !prevChecked;
    });
  };

  return (
    <button
      type="button"
      className={cn(
        'flex justify-center items-center font-extrabold w-4 h-4 text-xs rounded-[0.25rem] shrink-0',
        checked
          ? `${checkedCheckClass || 'text-white'} bg-primary`
          : 'text-gray-300 bg-gray-100',
        className
      )}
      onClick={checkHandler}
    >
      ✓
    </button>
  );
};

export default CheckButton;
