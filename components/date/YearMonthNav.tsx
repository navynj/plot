'use client';

import { MONTHS } from '@/constants/date';
import { todayAtom } from '@/store/todo';
import { cn } from '@/util/cn';
import { useAtom } from 'jotai';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Overlay from '../overlay/Overlay';

const ID = 'year-month-nav';
const YEARS = Array.from({ length: 2000 }, (v, i) => 2000 + i);

const YearMonthNav = () => {
  const router = useRouter();

  const [today, setToday] = useAtom(todayAtom);
  const [year, setYear] = useState(today.getFullYear());

  const closeHandler = () => {
    router.back();
  };

  const todayHandler = (month: number) => {
    setToday((prev) => {
      const next = new Date(prev);
      next.setFullYear(year);
      next.setMonth(month);
      return next;
    });
    closeHandler();
  };

  return (
    <div>
      <Link
        href={`?${ID}=show`}
        className="pl-4 flex flex-col items-start font-extrabold leading-tight"
      >
        <button type="button" className="text-lg">
          {today.getFullYear()}
        </button>
        <button type="button" className="text-4xl">
          {today.toLocaleDateString('en-US', { month: 'long' })}
        </button>
      </Link>
      <Overlay
        id={ID}
        fromTop={true}
        isLeft={true}
        title={
          <select
            className="content-box w-auto bg-transparent font-black text-3xl"
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
              setYear(+event.target.value);
            }}
            defaultValue={year}
          >
            {YEARS.map((year) => {
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
        }
      >
        <div className="grid grid-cols-3 gap-4">
          {MONTHS.map((month, i) => (
            <button
              key={month}
              onClick={todayHandler.bind(null, i)}
              className={cn(
                'flex justify-center p-4 font-semibold border rounded-lg',
                today.getMonth() === i && today.getFullYear() === year
                  ? 'bg-primary text-white border-none'
                  : ''
              )}
            >
              {month}
            </button>
          ))}
        </div>
      </Overlay>
    </div>
  );
};

export default YearMonthNav;
