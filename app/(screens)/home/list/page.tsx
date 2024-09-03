import DailyHeader from '@/components/layout/DailyHeader';
import CategoryTab from '../_components/ui/CategoryTab';
import ScheduleColumns from './_components/left/ScheduleColumns';
import DoneList from './_components/right/DoneList';
import TrackList from './_components/right/TrackList';

const page = () => {
  return (
    <>
      <div className="lg:w-[50%]">
        <DailyHeader className="my-12" />
        <ScheduleColumns />
      </div>
      <div className="lg:w-[50%] lg:h-[60vh] overflow-scroll pb-16">
        <TrackList />
        <DoneList />
      </div>
    </>
  );
};

export default page;
