import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import { useEffect, useState } from 'react';

interface CheckButtonProps extends ClassNameProps {
  checked: boolean;
  onChecked: (checked: boolean) => void;
  checkedCheckClass?: string;
}

const CheckButton = ({
  checked,
  onChecked,
  checkedCheckClass,
  className,
}: CheckButtonProps) => {

  const checkHandler = () => {
    onChecked(!checked);
  }

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
