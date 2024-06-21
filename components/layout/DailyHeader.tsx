'use client';

import DayNav from '@/components/date/DayNav';
import { todayAtom } from '@/store/todo';
import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import { getDashDate } from '@/util/date';
import { findParentByClassName } from '@/util/html';
import { useAtom } from 'jotai';
import { useRef } from 'react';
import YearMonth from '../date/YearMonth';

const DailyHeader = ({ className }: ClassNameProps) => {
  const dateInputLeft = useRef<HTMLInputElement>(null);
  const dateInputRight = useRef<HTMLInputElement>(null);
  const [today, setToday] = useAtom(todayAtom);

  const showDatepickerHandler = (event: React.MouseEvent<HTMLElement>) => {
    const leftPicker = dateInputLeft.current;
    const rightPicker = dateInputRight.current;

    const target = event.target as HTMLElement;

    if (target.tagName !== 'BUTTON') {
      const parentDayNav = findParentByClassName(target, 'daynav');
      if (parentDayNav) {
        rightPicker?.showPicker();
      } else {
        leftPicker?.showPicker();
      }
    }
  };

  const dateChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setToday(new Date(event.target.value));
  };

  return (
    <div
      className={cn('pl-4 pr-2 flex justify-between items-end', className)}
      onClick={showDatepickerHandler}
    >
      <YearMonth date={today} />
      <DayNav />
      <input
        ref={dateInputLeft}
        type="date"
        onChange={dateChangeHandler}
        value={getDashDate(today)}
        className="absolute invisible"
        required
      />
      <input
        ref={dateInputRight}
        type="date"
        onChange={dateChangeHandler}
        value={getDashDate(today)}
        className="absolute invisible right-0"
        required
      />
    </div>
  );
};

export default DailyHeader;
