'use client';

import React, { PropsWithChildren } from 'react';
import ConfirmCancelButton from './ConfirmCancelButton';
import Overlay, { OverlayProps } from './Overlay';
import { useRouter } from 'next/navigation';

const OverlayForm = ({ children, ...props }: PropsWithChildren<OverlayProps>) => {
  const router = useRouter();
  const submitHandler = async () => {
    closeHandler();
  };

  const closeHandler = () => {
    router.back();
  };

  return (
    <Overlay {...props}>
      <form onSubmit={submitHandler}>
        <div>{children}</div>
        <ConfirmCancelButton onCancel={closeHandler} />
      </form>
    </Overlay>
  );
};

export default OverlayForm;
