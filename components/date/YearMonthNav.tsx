'use client';

import { todayAtom } from '@/store/todo';
import { useAtomValue } from 'jotai';

// TODO: yearMonth Nav Overlay 열기 동작
const YearMonthNav = () => {
  const today = useAtomValue(todayAtom);

  return (
    <div className="pl-4 flex flex-col items-start font-extrabold leading-tight">
      <button className="text-lg">{today.getFullYear()}</button>
      <button className="text-4xl">
        {today.toLocaleDateString('en-US', { month: 'long' })}
      </button>
    </div>
  );
};

export default YearMonthNav;
