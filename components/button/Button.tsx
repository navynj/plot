import { cn } from '@/util/cn';
import React, { PropsWithChildren } from 'react';

const Button = ({
  className,
  children,
  ...props
}: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => {
  return (
    <button
      type="button"
      {...props}
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
