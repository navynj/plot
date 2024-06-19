import { ClassNameProps } from '@/types/className';
import { PropsWithChildren, useEffect, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  DroppableProps,
  OnDragEndResponder,
} from 'react-beautiful-dnd';

interface DraggableListProps extends ClassNameProps {
  id: string;
  onDragEnd?: (from: number, to: number) => void;
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
    <DragDropContext onDragEnd={sortHandler}>
      <StrictModeDroppable droppableId={id}>
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
