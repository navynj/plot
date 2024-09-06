'use client';

import WeeklyColumn from '@/components/calender/WeeklyColumn';
import DateHeader from '@/components/layout/DateHeader';
import { dateViewAtom } from '@/store/ui';
import { useAtomValue } from 'jotai';
import TimelineColumn from '../../../../components/calender/TimelineColumn';
import DoneList from './_components/list/DoneList';
import TrackList from './_components/list/TrackList';

const Page = () => {
  const dateView = useAtomValue(dateViewAtom);

  return (
    <div className="w-full">
      <div>
        <DateHeader className="my-12" />
        {dateView === 'weekly' && <WeeklyColumn />}
        {dateView === 'daily' && <TimelineColumn />}
      </div>
      <div className="lg:w-[50%] lg:h-[60vh] overflow-scroll pb-16">
        <TrackList />
        <DoneList />
      </div>
    </div>
  );
};

export default Page;
