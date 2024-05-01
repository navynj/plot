'use client';

import OverlayForm from '@/components/overlay/OverlayForm';
import { useSearchParams } from 'next/navigation';

const TodoInputOverlay = () => {
  const params = useSearchParams();
  const subjectId = params.get('subject');

  return (
    <OverlayForm id="todo-input" isRight={true}>
      TodoInputOverlay
    </OverlayForm>
  );
};

export default TodoInputOverlay;
