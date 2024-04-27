import { ClassNameType } from '@/types/className';
import { cn } from '@/util/cn';
import { PropsWithChildren } from 'react';

interface ButtonProps extends ClassNameType {
  type?: 'submit' | 'reset' | 'button';
  onClick?: () => void;
}

const Button = ({
  type,
  onClick,
  className,
  children,
}: PropsWithChildren<ButtonProps>) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        'px-8 py-4 rounded-lg bg-primary text-white font-extrabold',
        className
      )}
    >
      {children}
    </button>
  );
};

export default Button;
