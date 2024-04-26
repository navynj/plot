'use client';

import Button from '@/components/button/Button';
import IconHolder from '@/components/holder/IconHolder';
import Loader from '@/components/loader/Loader';
import { subjectsAtom } from '@/store/subject';
import { useAtom } from 'jotai';

const SubjectColumns = () => {
  const [{ data, isPending, isError }] = useAtom(subjectsAtom);

  return (
    <div
      className={`flex justify-start w-full overflow-x-scroll scrollbar-hide border-primary border-b-4 ${
        isPending ? 'justify-center py-20' : ''
      }`}
    >
      {isPending && <Loader />}
      {data?.map((subject) => (
        <div
          key={subject.title}
          className="flex flex-col items-center justify-between w-28 lg:w-36 shrink-0 space-y-4 px-2 py-4 border-gray-200 border-r"
        >
          <div className="flex flex-col space-y-2 items-center">
            <IconHolder isCircle={true}>{subject.icon}</IconHolder>
            <div className="text-center">
              <p className="text-sm font-semibold">{subject.category.title}</p>
              <p className="text-lg font-extrabold leading-tight">{subject.title}</p>
            </div>
          </div>
          <Button className="px-2 py-1 text-sm rounded-md">Add Todo</Button>
        </div>
      ))}
    </div>
  );
};

export default SubjectColumns;
