'use client';

import { useRouter } from 'next/navigation';
import { PropsWithChildren } from 'react';
import ConfirmCancelButton from './ConfirmCancelButton';
import Overlay from './Overlay';
import { OverlayProps } from './OverlayContent';

const OverlayForm = ({ children, ...props }: PropsWithChildren<OverlayProps>) => {
  const router = useRouter();
  const submitHandler = async () => {
    closeHandler();
  };

  const closeHandler = () => {
    router.back();
  };

  return (
    <Overlay hideX={true} {...props}>
      <form onSubmit={submitHandler} className="w-full">
        {children}
        <ConfirmCancelButton onCancel={closeHandler} />
      </form>
    </Overlay>
  );
};

export default OverlayForm;
