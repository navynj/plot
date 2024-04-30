import DailyHeader from '@/components/layout/DailyHeader';
import CategorySubjectWrapper from './_components/CategorySubjectWrapper';
import HomeListOverlays from './_components/HomeListOverlays';
import TodoList from './_components/TodoList';

const page = () => {
  return (
    <>
      <div className="lg:w-[50%]">
        <DailyHeader className="my-12" />
        <div className="flex flex-col items-center space-y-4">
          <CategorySubjectWrapper />
        </div>
      </div>
      <div className="lg:w-[50%]">
        <TodoList />
      </div>
    </>
  );
};

export default page;
