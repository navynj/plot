'use client';

import Button from '@/components/button/Button';
import DraggableItem from '@/components/draggable/DraggableItem';
import DraggableList from '@/components/draggable/DraggableList';
import IconHolder from '@/components/holder/IconHolder';
import Overlay from '@/components/overlay/Overlay';
import { subjectsAtom } from '@/store/subject';
import { useAtom } from 'jotai';
import { LexoRank } from 'lexorank';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaPencil, FaPlus, FaTrashCan } from 'react-icons/fa6';

const SubjectListEditOverlay = () => {
  const router = useRouter();

  const [{ data: subjects, refetch: refetchSubjects }] = useAtom(subjectsAtom);

  const removeHandler = async (id: string) => {
    if (confirm('정말 삭제할까요?')) {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/subject/${id}`, {
        method: 'DELETE',
      });
      refetchSubjects();
    }
  };

  const dragEndHandler = async (from: number, to: number) => {
    let newLexo: LexoRank;

    if (!subjects) {
      console.error('Subjects not exist');
      return;
    }

    // if (to >= subjects.length) {
    //   const lastItem = subjects[subjects.length - 1];
    //   newLexo = lastItem && lastItem.rank.genNext();
    // } else if (to <= 0) {
    //   const firstItem = subjects[0];
    //   newLexo = firstItem && firstItem.rank && firstItem.rank.genPrev();
    // } else {
    //   newLexo = subjects[to]?.rank.between(subjects[to + 1].rank);
    // }

    // console.log(subjects[from].id, newLexo);

    // await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/subject/${subjects[from].id}`, {
    //   method: 'PATCH',
    //   body: JSON.stringify({
    //     rank: newLexo,
    //   }),
    // });
    // refetchSubjects();

    // return true;
  };

  return (
    <Overlay title="Edit subject list" id="subject-list-edit" isRight={true} hideX={true}>
      <DraggableList id="draggable-subject-list" onDragEnd={dragEndHandler}>
        {subjects?.map(({ id, icon, category, title }, i) => (
          <DraggableItem
            key={id}
            id={id}
            idx={i}
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
                <Link
                  href={`/home/list?subject-edit=show&subjectId=${id}`}
                  className="p-2"
                >
                  <FaPencil />
                </Link>
                <div
                  className="p-2"
                  onClick={() => {
                    removeHandler(id);
                  }}
                >
                  <FaTrashCan />
                </div>
              </div>
            </div>
          </DraggableItem>
        ))}
      </DraggableList>
      <Link
        href="/home/list?subject-edit=show"
        className="w-full p-4 flex gap-1 justify-center items-center text-xs text-center font-extrabold"
      >
        <FaPlus />
        Add subject
      </Link>
      <Button
        className="w-full mt-4"
        onClick={() => {
          router.back();
        }}
      >
        Close
      </Button>
    </Overlay>
  );
};

export default SubjectListEditOverlay;
