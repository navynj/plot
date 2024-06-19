import EmojiOverlay from '@/components/emoji/EmojiOverlay';
import DailyHeader from '@/components/layout/DailyHeader';
import { Suspense } from 'react';
import SubjectColumns from './_components/left/SubjectColumns';
import SubjectEditOverlay from './_components/overlays/subject/SubjectEditOverlay';
import SubjectListEditOverlay from './_components/overlays/subject/SubjectListEditOverlay';
import SubjectSelectOverlay from './_components/overlays/subject/SubjectSelectOverlay';
import TodoInputOverlay from './_components/overlays/todo/TodoInputOverlay';
import TodoList from './_components/right/TodoList';
import CategoryTab from './_components/ui/CategoryTab';

const page = () => {
  return (
    <>
      <div className="lg:w-[50%]">
        <DailyHeader className="my-12" />
        <div className="flex flex-col items-center space-y-4">
          <CategoryTab id="todolist-left-category" />
          <SubjectColumns />
        </div>
      </div>
      <div className="lg:w-[50%] lg:h-[60vh] overflow-scroll">
        <TodoList />
      </div>
      {/* overlays */}
      <SubjectSelectOverlay />
      <SubjectListEditOverlay />
      <Suspense>
        <SubjectEditOverlay />
        <TodoInputOverlay />
      </Suspense>
      <EmojiOverlay />
    </>
  );
};

export default page;
