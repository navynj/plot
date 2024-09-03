'use client';

import { todayAtom } from '@/store/track';
import { useAtom } from 'jotai';
import DayDate from './DayDate';

const DayNav = () => {
  const [today, setToday] = useAtom(todayAtom);

  // NOTE: 24 hour to milliseconds - 8.64e+7
  const goPrevDay = () => {
    setToday((prevDay) => {
      const nextTime = prevDay.getTime() - 8.64e7;
      return new Date(nextTime);
    });
  };

  const goNextDay = () => {
    setToday((prevDay) => {
      const nextTime = prevDay.getTime() + 8.64e7;
      return new Date(nextTime);
    });
  };

  return (
    <div className="daynav flex gap-4 items-center font-extrabold">
      <button type="button" onClick={goPrevDay}>
        &lt;
      </button>
      <DayDate date={today} />
      <button type="button" onClick={goNextDay}>
        &gt;
      </button>
    </div>
  );
};

export default DayNav;
