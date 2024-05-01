'use client';

import { cn } from '@/util/cn';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { PropsWithChildren, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BiX } from 'react-icons/bi';
export interface OverlayProps {
  id: string;
  title?: React.ReactNode;
  onClose?: () => void;
  isLeft?: boolean;
  isRight?: boolean;
  fromTop?: boolean;
  hideX?: boolean;
  className?: string;
}

const Overlay = ({
  id,
  title,
  onClose,
  isLeft,
  isRight,
  fromTop,
  hideX,
  className,
  children,
}: PropsWithChildren<OverlayProps>) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => setMounted(true), []);

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
    router.back();
    onClose && onClose();
  };

  return (
    mounted &&
    createPortal(
      <Suspense>
        <div className="mx-auto">
          <AnimatePresence>
            {isOpen && (
              <>
                {/* backdrop */}
                <motion.div
                  onClick={closeHandler}
                  className={
                    'fixed top-0 bottom-0 left-0 right-0 z-[99] bg-black lg:bg-white'
                  }
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.7 }}
                  exit={{ opacity: 0 }}
                />
                {/* Overaly */}
                <motion.div
                  className={cn(
                    'absolute bottom-0 w-full max-w-[640px] p-8 rounded-tl-3xl rounded-tr-3xl bg-white z-[100] shadow-[0_4px_60px_0_rgba(99,99,99,0.2)] lg:shadow-none',
                    fromTop ? 'top-0 bottom-auto rounded-[0_0_1.5rem_1.5rem]' : '',
                    className
                  )}
                  layout
                  initial={{
                    transform: `translateY(${fromTop ? -100 : 100}%) translateZ(0)`,
                  }}
                  animate={{ transform: 'translateY(0) translateZ(0)' }}
                  exit={{
                    transform: `translateY(${fromTop ? -100 : 100}%) translateZ(0)`,
                  }}
                >
                  {(title || !hideX) && (
                    <div className="mb-4 flex justify-between items-center font-extrabold text-lg">
                      {title && <h3>{title}</h3>}
                      {!hideX && (
                        <button onClick={closeHandler}>
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
      </Suspense>,
      document.getElementById(
        `overlay-container${
          fromTop
            ? isLeft
              ? '-tl'
              : isRight
              ? '-tr'
              : ''
            : isLeft
            ? '-bl'
            : isRight
            ? '-br'
            : ''
        }`
      ) || document.body
    )
  );
};

export default Overlay;
