'use client';

import Button from '@/components/button/Button';
import IconHolder from '@/components/holder/IconHolder';
import Overlay from '@/components/overlay/Overlay';
import { SubjectType } from '@/types/subject';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaPencil, FaPlus } from 'react-icons/fa6';
import CategoryTab from '../../ui/CategoryTab';
import SubjectListWrapper from '../../ui/SubjectListWrapper';

const SubjectSelectOverlay = () => {
  return (
    <Overlay
      id="subject-select"
      title="Select subject"
      isRight={true}
      className="flex flex-col items-center"
    >
      <CategoryTab id="subject-select-overlay-category" className="mt-4 text-xs" />
      <SubjectListWrapper className="flex flex-col items-center my-6 space-y-5 max-h-[60vh] overflow-scroll">
        <SubjectSelectItem />
      </SubjectListWrapper>
      <div className="flex justify-center gap-16">
        <Link
          href="/home/list?subject-edit=show"
          className="w-full p-4 flex gap-1 justify-center items-center text-xs text-center font-extrabold"
        >
          <FaPlus />
          Add subject
        </Link>
        <Link
          href="/home/list?subject-list-edit=show"
          className="w-full p-4 flex gap-1 justify-center items-center text-xs text-center font-extrabold"
        >
          <FaPencil />
          Edit subject
        </Link>
      </div>
    </Overlay>
  );
};

const SubjectSelectItem = ({ id, title, icon, category }: Partial<SubjectType>) => {
  const router = useRouter();

  const selectSubjectHandler = () => {
    router.replace(`/home/list?todo-input=show&subjectId=${id}`);
  };

  return (
    <li
      key={title}
      className="w-full flex items-center justify-between px-4 cursor-pointer"
      onClick={selectSubjectHandler}
    >
      <div className="flex gap-2 items-center">
        <IconHolder isCircle={true}>{icon}</IconHolder>
        <div className="text-left">
          <p className="text-xs font-semibold">{category?.title}</p>
          <p className="text-lg font-bold leading-tight">{title}</p>
        </div>
      </div>
      <Button className="px-2 py-1 text-xs rounded-md">Add Todo</Button>
    </li>
  );
};

export default SubjectSelectOverlay;
