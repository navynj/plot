'use client'

import DateHeader from '@/components/layout/DateHeader';
import CategoryTab from '../_components/ui/CategoryTab';
import TimelineColumn from '../../../../components/calender/TimelineColumn';
import DoneList from './_components/list/DoneList';
import TrackList from './_components/list/TrackList';
import { useAtomValue } from 'jotai';
import { dateViewAtom } from '@/store/ui';

const page = () => {
  const dateView = useAtomValue(dateViewAtom);

  return (
    <>
      <div className="lg:w-[50%]">
        <DateHeader className="my-12" />
        {dateView === 'daily' && <TimelineColumn />}
      </div>
      <div className="lg:w-[50%] lg:h-[60vh] overflow-scroll pb-16">
        <TrackList />
        <DoneList />
      </div>
    </>
  );
};

export default page;
