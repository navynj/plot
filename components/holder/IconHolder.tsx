import { ClassNameType } from '@/types/className';
import { cn } from '@/util/cn';
import { PropsWithChildren } from 'react';

interface IconProps extends ClassNameType {
  isCircle?: boolean;
}

const IconHolder = ({ isCircle, className, children }: PropsWithChildren<IconProps>) => {
  return (
    <div
      className={cn(
        'flex justify-center items-center w-12 h-12 text-2xl bg-gray-100 rounded-lg',
        isCircle ? 'rounded-full' : '',
        className
      )}
    >
      {children}
    </div>
  );
};

export default IconHolder;
