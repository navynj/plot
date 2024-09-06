'use client';

import { todayAtom } from '@/store/track';
import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import { getDashDate } from '@/util/date';
import { findParentByClassName } from '@/util/html';
import { useAtom } from 'jotai';
import { useRef } from 'react';
import DateViewTab from '../date/DateViewTab';
import YearMonth from '../date/YearMonth';

const DailyHeader = ({ className }: ClassNameProps) => {
  const dateInput = useRef<HTMLInputElement>(null);
  const [today, setToday] = useAtom(todayAtom);

  const showDatepickerHandler = (event: React.MouseEvent<HTMLElement>) => {
    dateInput.current?.showPicker();
  };

  const dateChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setToday(new Date(event.target.value));
  };

  return (
    <div className={cn('pl-4 pr-2 flex justify-between items-end', className)}>
      <YearMonth date={today} onClick={showDatepickerHandler} />
      <DateViewTab />
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

export default DailyHeader;
