import { cn } from '@/util/cn';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { PropsWithChildren, useEffect, useState } from 'react';

export interface OverlayContentProps {
  id: string;
  onClose?: () => void;
  className?: string;
}

const OverlayContent = ({
  id,
  onClose,
  className,
  children,
}: PropsWithChildren<OverlayContentProps>) => {
  const router = useRouter();

  const searchParams = useSearchParams();
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
    router.back();
    onClose && onClose();
  };

  return (
    <div className="mx-auto">
      <AnimatePresence>
        {isOpen && (
          <>
            {/* backdrop */}
            <motion.div
              className="fixed top-0 bottom-0 left-0 right-0 bg-black z-[99]"
              onClick={closeHandler}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
            />
            {/* Overaly */}
            <motion.div
              className={cn(
                'absolute bottom-0 left-0 right-0 w-full max-w-[640px] p-[2rem] rounded-tl-3xl rounded-tr-3xl bg-white z-[100] shadow-[0_4px_60px_0_rgba(99,99,99,0.2)]',
                className
              )}
              layout
              initial={{ transform: 'translateY(100%) translateZ(0)' }}
              animate={{ transform: 'translateY(0) translateZ(0)' }}
              exit={{ transform: 'translateY(100%) translateZ(0)' }}
            >
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OverlayContent;
