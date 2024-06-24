import DailyHeader from '@/components/layout/DailyHeader';
import TodoList from '../list/_components/right/TodoList';
import ScheduleBlocks from './_components/ScheduleBlocks';

const page = () => (
  <>
    <div className="lg:w-[50%]">
      <DailyHeader className="my-12" />
      <ScheduleBlocks />
    </div>
    <div className="hidden lg:block lg:w-[50%] lg:h-[60vh] overflow-scroll">
      <TodoList />
    </div>
  </>
);

export default page;
