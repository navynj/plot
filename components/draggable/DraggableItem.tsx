import { ClassNameProps } from '@/types/className';
import { PropsWithChildren } from 'react';
import { Draggable, DraggableProvided } from 'react-beautiful-dnd';

interface DraggableItemProps extends ClassNameProps {
  id: string;
  idx: number;
  preventDrag?: boolean;
}

const DraggableItem = ({
  id,
  idx,
  preventDrag,
  className,
  children,
}: PropsWithChildren<DraggableItemProps>) => {
  return (
    <Draggable draggableId={id} key={id} index={idx}>
      {(provided, snapshot) => {
        const lockedProvided = lockXAxis(provided);
        return (
          <li
            key={id}
            {...lockedProvided.draggableProps}
            ref={lockedProvided.innerRef}
            className={className}
          >
            {children}
            {!preventDrag && (
              <div {...lockedProvided.dragHandleProps} className="p-2">
                =
              </div>
            )}
          </li>
        );
      }}
    </Draggable>
  );
};

export const lockXAxis = (provided: DraggableProvided) => {
  const transform = provided?.draggableProps?.style?.transform;
  if (transform) {
    var t = transform.split(',')[1];
    provided.draggableProps!.style!.transform = 'translate(0px,' + t;
  }
  return provided;
};

export default DraggableItem;
