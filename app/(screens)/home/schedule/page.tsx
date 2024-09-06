import DailyHeader from '@/components/layout/DateHeader';
import TrackList from '../list/_components/list/TrackList';
import ScheduleBlocks from './_components/ScheduleBlocks';

const page = () => (
  <>
    <div className="lg:w-[50%]">
      {/* <DailyHeader className="my-12" /> */}
      <ScheduleBlocks />
    </div>
    <div className="hidden lg:block lg:w-[50%] lg:h-[60vh] overflow-scroll">
      <TrackList />
    </div>
  </>
);

export default page;
