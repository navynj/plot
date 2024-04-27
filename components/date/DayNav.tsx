'use client';

import { todayAtom } from '@/store/todo';
import { useAtom } from 'jotai';

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
    <div className="flex gap-4 items-center font-extrabold">
      <button onClick={goPrevDay}>&lt;</button>
      <div className="text-center">
        <p className="text-xs leading-3">
          {today.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
        </p>
        <p className="text-2xl">{today.getDate()}</p>
      </div>
      <button onClick={goNextDay}>&gt;</button>
    </div>
  );
};

export default DayNav;
