'use client';

import { todayAtom } from '@/store/track';
import { useAtom } from 'jotai';
import DayDate from './DayDate';
import { cn } from '@/util/cn';
import { ClassNameProps } from '@/types/className';
import { useRef } from 'react';
import { getDashDate } from '@/util/date';

interface DayNavProps extends ClassNameProps {
  isVertical?: boolean;
}

const DayNav = ({ isVertical, className }: DayNavProps) => {
  const dateInput = useRef<HTMLInputElement>(null);
  const [today, setToday] = useAtom(todayAtom);

  const showDatepickerHandler = (event: React.MouseEvent<HTMLElement>) => {
    dateInput.current?.showPicker();
  };

  const dateChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setToday(new Date(event.target.value));
  };

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
    <div
      className={cn(
        `daynav flex ${isVertical ? 'flex-col' : ''} gap-4 items-center font-extrabold`,
        className
      )}
    >
      <button type="button" className="text-sm" onClick={goPrevDay}>
        {isVertical ? '↑' : '<'}
      </button>
      <DayDate date={today} onClick={showDatepickerHandler} />
      <button type="button" className="text-sm" onClick={goNextDay}>
        {isVertical ? '↓' : '>'}
      </button>
      <input
        ref={dateInput}
        type="date"
        onChange={dateChangeHandler}
        value={getDashDate(today)}
        className="absolute invisible"
        required
      />
    </div>
  );
};

export default DayNav;
