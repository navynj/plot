'use client';

import { lockXAxis } from '@/components/draggable/DraggableItem';
import DraggableList from '@/components/draggable/DraggableList';
import IconHolder from '@/components/holder/IconHolder';
import Loader from '@/components/loader/Loader';
import Overlay from '@/components/overlay/Overlay';
import SaveCancelButton from '@/components/overlay/SaveCancelButton';
import { subjectsAtom } from '@/store/subject';
import { getLexo } from '@/util/lexo';
import { useAtom } from 'jotai';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Draggable,
  DraggableProvided,
  DraggableRubric,
  DraggableStateSnapshot,
} from 'react-beautiful-dnd';
import { FaPencil, FaPlus, FaTrashCan } from 'react-icons/fa6';

const SubjectListEditOverlay = () => {
  const router = useRouter();

  const [{ data, refetch: refetchSubjects, isFetching }] = useAtom(subjectsAtom);

  const [subjects, setSubjects] = useState(data);
  const [isPending, setIsPending] = useState(false);

  const submitHandler = async () => {
    const url = process.env.NEXT_PUBLIC_BASE_URL + '/api/subject';

    if (!subjects) {
      console.error('Subjects not exist');
      return;
    }

    let isEqual = subjects.length === data?.length;

    if (isEqual) {
      data?.forEach((item, i) => {
        if (item.id !== subjects[i]?.id) {
          isEqual = false;
          return;
        }
      });
    }

    if (isEqual) {
      router.back();
      return;
    }

    setIsPending(true);

    for (const subject of subjects) {
      await fetch(`${url}/${subject.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ rank: subject.rank.toString() }),
      });
    }

    if (data) {
      const subjectIds = subjects.map((subject) => subject.id);
      const removingSubjects = data.filter((item) => !subjectIds.includes(item.id));

      for (const subject of removingSubjects) {
        await fetch(`${url}/${subject.id}`, { method: 'DELETE' });
      }
    }

    refetchSubjects();
    setIsPending(false);
    router.back();
  };

  const removeHandler = async (i: number) => {
    setSubjects((prev) => {
      const next = prev ? [...prev] : [];
      next.splice(i, 1);
      return next;
    });
  };

  const dragEndHandler = async (from: number, to: number) => {
    setSubjects((prev) => {
      const next = prev ? [...prev] : [];
      next[from].rank = getLexo(next, from, to);
      return next;
    });
  };

  useEffect(() => {
    setSubjects(data);
  }, [data]);

  const renderSubject = (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const lockedProvided = lockXAxis(provided);
    const i = rubric.source.index;
    if (subjects) {
      const { id, icon, title, category } = subjects[i];
      return (
        <li
          {...lockedProvided.draggableProps}
          ref={lockedProvided.innerRef}
          className="py-2 flex justify-between gap-2 items-center"
        >
          <div className="w-full flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <IconHolder isCircle={true}>{icon}</IconHolder>
              <div className="text-left">
                <p className="text-xs font-semibold">{category?.title}</p>
                <p className="text-lg font-bold leading-tight">{title}</p>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              <Link href={`/home/list?subject-edit=show&subjectId=${id}`} className="p-2">
                <FaPencil />
              </Link>
              <div
                className="p-2"
                onClick={() => {
                  removeHandler(i);
                }}
              >
                <FaTrashCan />
              </div>
            </div>
          </div>
          <div {...lockedProvided.dragHandleProps} className="p-2">
            =
          </div>
        </li>
      );
    } else {
      return <></>;
    }
  };

  return (
    <Overlay title="Edit subject list" id="subject-list-edit" isRight={true} hideX={true}>
      <DraggableList
        id="draggable-subject-list"
        onDragEnd={dragEndHandler}
        renderClone={renderSubject}
      >
        {(isFetching || isPending) && (
          <Loader className="w-full mt-4 flex justify-center" />
        )}
        {!(isFetching || isPending) &&
          subjects
            ?.sort((a, b) => (a.rank < b.rank ? -1 : 1))
            .map(({ id }, i) => {
              return (
                <Draggable key={id} draggableId={id} index={i}>
                  {renderSubject}
                </Draggable>
              );
            })}
      </DraggableList>
      <Link
        href="/home/list?subject-edit=show"
        className="w-full p-4 flex gap-1 justify-center items-center text-xs text-center font-extrabold"
      >
        <FaPlus />
        Add subject
      </Link>
      <SaveCancelButton onSave={submitHandler} isPending={isPending} />
    </Overlay>
  );
};

export default SubjectListEditOverlay;
