'use client';

import { useRouter } from 'next/navigation';
import { PropsWithChildren } from 'react';
import { FieldValues, UseFormReturn } from 'react-hook-form';
import ConfirmCancelButton from './ConfirmCancelButton';
import Overlay from './Overlay';
import { OverlayProps } from './OverlayContent';

interface OverlayFormProps<T extends FieldValues> extends OverlayProps {
  form: UseFormReturn<T, any, undefined>;
  onSubmit: (values: T) => Promise<void>;
  disableReset?: boolean;
}

const OverlayForm = <T extends FieldValues>({
  children,
  form,
  onSubmit,
  disableReset,
  onClose,
  ...props
}: PropsWithChildren<OverlayFormProps<T>>) => {
  const router = useRouter();

  const submitHandler = async (values: T) => {
    try {
      await onSubmit(values);
    } catch (error) {
      console.error(error);
    }

    closeHandler();
  };

  const closeHandler = () => {
    onClose && onClose();
    !disableReset && form.reset();
  };

  const cancleHandler = () => {
    closeHandler();
    router.back();
  };

  return (
    <Overlay hideX={true} {...props} onClose={closeHandler}>
      <form onSubmit={form.handleSubmit(submitHandler)} className="w-full">
        {children}
        <ConfirmCancelButton
          onCancel={cancleHandler}
          isPending={form.formState.isSubmitting}
        />
      </form>
    </Overlay>
  );
};

export default OverlayForm;
