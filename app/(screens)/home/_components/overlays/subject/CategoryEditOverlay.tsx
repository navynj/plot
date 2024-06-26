'use client';

import { lockXAxis } from '@/components/draggable/DraggableItem';
import DraggableList from '@/components/draggable/DraggableList';
import Loader from '@/components/loader/Loader';
import Overlay from '@/components/overlay/Overlay';
import SaveCancelButton from '@/components/overlay/SaveCancelButton';
import { categoriesAtom } from '@/store/category';
import { getLexo } from '@/util/lexo';
import { useAtomValue } from 'jotai';
import { LexoRank } from 'lexorank';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Draggable,
  DraggableProvided,
  DraggableRubric,
  DraggableStateSnapshot,
} from 'react-beautiful-dnd';
import { FaPlus, FaTrashCan } from 'react-icons/fa6';

const CategoryEditOverlay = () => {
  const router = useRouter();

  const { data, refetch: refetchCategories, isFetching } = useAtomValue(categoriesAtom);
  const [categories, setCategories] = useState(data);
  const [isPending, setIsPending] = useState(false);

  const submitHandler = async () => {
    setIsPending(true);

    const url = process.env.NEXT_PUBLIC_BASE_URL + '/api/category';

    if (!categories) {
      console.error('Categories not exist');
      return;
    }

    for (const category of categories) {
      if (typeof category.id === 'string') {
        await fetch(`${url}/${category.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...category, rank: category.rank.toString() }),
        });
      } else {
        await fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            ...category,
            rank: category.rank.toString(),
            id: undefined,
          }),
        });
      }
    }

    if (data) {
      const categoryIds = categories.map((category) => category.id);
      const removingCategories = data.filter((item) => !categoryIds.includes(item.id));

      for (const category of removingCategories) {
        await fetch(`${url}/${category.id}`, { method: 'DELETE' });
      }
    }

    refetchCategories();
    setIsPending(false);
    router.back();
  };

  const changeHandler = (value: string, i: number) => {
    setCategories((prev) => {
      const next = prev ? [...prev] : [];
      next[i].title = value;
      return next;
    });
  };

  const removeHandler = (i: number) => {
    setCategories((prev) => {
      const next = prev ? [...prev] : [];
      next.splice(i, 1);
      return next;
    });
  };

  const addHandler = () => {
    setCategories((prev) => {
      let rank;

      if (!prev || prev?.length === 0) {
        rank = LexoRank.middle();
      } else {
        const lastItem = prev[prev.length - 1];
        rank = lastItem.rank.genNext();
      }

      const newItem = { id: new Date().getTime(), title: '', rank };

      if (prev) {
        return [...prev, newItem];
      } else {
        return [newItem];
      }
    });
  };

  const dragHandler = (from: number, to: number) => {
    setCategories((prev) => {
      const next = prev ? [...prev] : [];
      next[from].rank = getLexo(next, from, to);
      return next;
    });
  };

  const renderCategory = (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const lockedProvided = lockXAxis(provided);
    const i = rubric.source.index;
    return (
      <li
        {...lockedProvided.draggableProps}
        ref={lockedProvided.innerRef}
        className="flex items-center"
      >
        <input
          onChange={(event) => {
            changeHandler(event.target.value, i);
          }}
          value={categories ? categories[i].title : ''}
          className="w-full font-medium bg-gray-100 px-3 py-2.5 rounded-lg"
        />
        <button
          className="p-4 text-xs"
          onClick={() => {
            removeHandler(i);
          }}
        >
          <FaTrashCan />
        </button>
        <div {...lockedProvided.dragHandleProps} className="p-2">
          =
        </div>
      </li>
    );
  };

  useEffect(() => {
    setCategories(data);
  }, [data]);

  return (
    <Overlay id="category-edit" isRight={true} hideX={true}>
      <DraggableList
        id="category-edit-draggable"
        onDragEnd={dragHandler}
        renderClone={renderCategory}
        className="space-y-2"
      >
        {!isFetching &&
          categories
            ?.sort((a, b) => (a.rank < b.rank ? -1 : 1))
            .map(({ id }, i) => (
              <Draggable key={id.toString()} draggableId={id.toString()} index={i}>
                {renderCategory}
              </Draggable>
            ))}
        {isFetching && <Loader className="w-full flex justify-center" />}
      </DraggableList>
      {!isFetching && (
        <button
          className="w-full p-4 flex gap-1 justify-center items-center text-xs text-center font-extrabold"
          onClick={addHandler}
        >
          <FaPlus />
          Add category
        </button>
      )}
      <SaveCancelButton onSave={submitHandler} isPending={isPending} />
    </Overlay>
  );
};

export default CategoryEditOverlay;
