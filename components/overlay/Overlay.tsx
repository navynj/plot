import { PropsWithChildren, Suspense } from 'react';
import OverlayContent from './OverlayContent';

export interface OverlayProps {
  id: string;
  onClose?: () => void;
  className?: string;
}

const Overlay = (props: PropsWithChildren<OverlayProps>) => {
  return (
    <Suspense>
      <OverlayContent {...props} />
    </Suspense>
  );
};

export default Overlay;
