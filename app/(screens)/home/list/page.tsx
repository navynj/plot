import DailyHeader from '@/components/layout/DailyHeader';
import CategoryTab from '../_components/ui/CategoryTab';
import SubjectColumns from './_components/left/SubjectColumns';
import TodoList from './_components/right/TodoList';

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
    </>
  );
};

export default page;
