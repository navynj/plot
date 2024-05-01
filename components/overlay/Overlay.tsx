'use client';

import { PropsWithChildren, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import OverlayContent, { OverlayProps } from './OverlayContent';

const Overlay = ({
  children,
  fromTop,
  isLeft,
  isRight,
  ...props
}: PropsWithChildren<OverlayProps>) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    mounted &&
    createPortal(
      <Suspense>
        <OverlayContent fromTop={fromTop} {...props}>
          {children}
        </OverlayContent>
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
