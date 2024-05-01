import DailyHeader from '@/components/layout/DailyHeader';
import CategoryTab from './_components/left/CategoryTab';
import SubjectColumns from './_components/left/SubjectColumns';
import SubjectSelectOverlay from './_components/overlays/subject/SubjectSelectOverlay';
import TodoInputOverlay from './_components/overlays/todo/TodoInputOverlay';
import TodoList from './_components/right/TodoList';

const page = () => {
  return (
    <>
      <div className="lg:w-[50%]">
        <DailyHeader className="my-12" />
        <div className="flex flex-col items-center space-y-4">
          <CategoryTab />
          <SubjectColumns />
        </div>
      </div>
      <div className="lg:w-[50%] lg:h-[60vh] overflow-scroll">
        <TodoList />
      </div>
      {/* overlays */}
      <SubjectSelectOverlay />
      <TodoInputOverlay />
    </>
  );
};

export default page;