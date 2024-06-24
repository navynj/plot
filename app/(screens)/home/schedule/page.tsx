import DailyHeader from '@/components/layout/DailyHeader';
import TodoList from '../list/_components/right/TodoList';

const page = () => (
  <>
    <div className="lg:w-[50%]">
      <DailyHeader className="my-12" />
      <div className="flex flex-col items-center space-y-4"></div>
    </div>
    <div className="hidden lg:block lg:w-[50%] lg:h-[60vh] overflow-scroll">
      <TodoList />
    </div>
  </>
);

export default page;
