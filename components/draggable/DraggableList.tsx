import useTouchSensor from '@/hooks/use-touch-center';
import { ClassNameProps } from '@/types/className';
import { PropsWithChildren, useEffect, useState } from 'react';
import {
  DragDropContext,
  DraggableChildrenFn,
  Droppable,
  DroppableProps,
  OnDragEndResponder,
  useKeyboardSensor,
  useMouseSensor,
} from 'react-beautiful-dnd';

interface DraggableListProps extends ClassNameProps {
  id: string;
  onDragEnd?: (from: number, to: number) => void;
  renderClone?: DraggableChildrenFn;
}

export const StrictModeDroppable = ({ children, ...props }: DroppableProps) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) {
    return null;
  }
  return <Droppable {...props}>{children}</Droppable>;
};

const DraggableList = ({
  id,
  className,
  children,
  onDragEnd,
  renderClone,
}: PropsWithChildren<DraggableListProps>) => {
  const sortHandler: OnDragEndResponder = async (result) => {
    if (!result.destination) return;

    try {
      onDragEnd && (await onDragEnd(result.source.index, result.destination.index));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <DragDropContext
      onDragEnd={sortHandler}
      enableDefaultSensors={false}
      sensors={[useMouseSensor, useKeyboardSensor, useTouchSensor]}
    >
      <StrictModeDroppable droppableId={id} renderClone={renderClone}>
        {(provided) => (
          <ul
            id={id}
            ref={provided.innerRef}
            className={className}
            {...provided.droppableProps}
          >
            {children}
            {provided.placeholder}
          </ul>
        )}
      </StrictModeDroppable>
    </DragDropContext>
  );
};

export default DraggableList;
