'use client';

import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/util/cn';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { PropsWithChildren, useEffect, useState } from 'react';
import { BiX } from 'react-icons/bi';
export interface OverlayProps {
  id: string;
  title?: React.ReactNode;
  onClose?: () => void;
  isLeft?: boolean;
  isRight?: boolean;
  fromTop?: boolean;
  hideX?: boolean;
  backdropOpacity?: number;
  backdropZindex?: number;
  disableBackdrop?: boolean;
  className?: string;
}

const OverlayContent = ({
  id,
  title,
  onClose,
  fromTop,
  hideX,
  backdropOpacity,
  backdropZindex,
  disableBackdrop,
  className,
  children,
}: PropsWithChildren<OverlayProps>) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLg = useBreakpoint('lg');

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(searchParams.get(id) === 'show');
  }, [searchParams, id]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  const closeHandler = () => {
    if (disableBackdrop) {
      return;
    }
    onClose && onClose();
    router.back();
  };

  return (
    <>
      <div className="mx-auto">
        <AnimatePresence>
          {isOpen && (
            <>
              {/* backdrop */}
              <motion.div
                onClick={closeHandler}
                className={`fixed top-0 bottom-0 left-0 right-0 z-[${
                  backdropZindex === 0 ? 0 : backdropZindex || 99
                }] bg-black lg:bg-white`}
                initial={{ opacity: 0 }}
                animate={{ opacity: backdropOpacity === 0 ? 0 : backdropOpacity || 0.7 }}
                exit={{ opacity: 0 }}
              />
              {/* Overlay */}
              <motion.div
                className={cn(
                  'absolute bottom-0 w-full p-8 rounded-tl-3xl rounded-tr-3xl bg-white z-[100] shadow-[0_4px_60px_0_rgba(99,99,99,0.2)] lg:shadow-none',
                  fromTop ? 'top-0 bottom-auto rounded-[0_0_1.5rem_1.5rem]' : '',
                  className
                )}
                layout
                initial={{
                  transform: `translateY(${fromTop ? -100 : 100}%) translateZ(0)`,
                  opacity: isLg ? 0 : 1,
                }}
                animate={{ transform: 'translateY(0) translateZ(0)', opacity: 1 }}
                exit={{
                  transform: `translateY(${fromTop ? -100 : 100}%) translateZ(0)`,
                  opacity: isLg ? 0 : 1,
                }}
              >
                {(title || !hideX) && (
                  <div
                    className={cn(
                      'w-full mb-4 flex justify-between items-center font-extrabold text-lg',
                      title ? '' : ' flex-row-reverse'
                    )}
                  >
                    {title && <h3 className="w-full text-left">{title}</h3>}
                    {!hideX && (
                      <button type="button" onClick={closeHandler}>
                        <BiX />
                      </button>
                    )}
                  </div>
                )}
                {children}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default OverlayContent;
