'use client';

import { MONTHS } from '@/constants/date';
import { todayAtom } from '@/store/todo';
import { useAtom } from 'jotai';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
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
        <button className="text-lg">{today.getFullYear()}</button>
        <button className="text-4xl">
          {today.toLocaleDateString('en-US', { month: 'long' })}
        </button>
      </Link>
      <Suspense>
        <Overlay id={ID}>
          {/* year select */}
          <div className="flex justify-between items-center mb-4">
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
            <button onClick={closeHandler} className="p-4 text-sm font-extrabold">
              Close
            </button>
          </div>
          {/* month grid */}
          <div className="grid grid-cols-3 gap-4">
            {MONTHS.map((month, i) => (
              <button
                key={month}
                onClick={todayHandler.bind(null, i)}
                className="flex justify-center p-4 font-semibold border rounded-lg"
              >
                {month}
              </button>
            ))}
          </div>
        </Overlay>
      </Suspense>
    </div>
  );
};

export default YearMonthNav;
