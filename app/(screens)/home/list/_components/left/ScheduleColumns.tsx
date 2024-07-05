'use client';

import CheckButton from '@/components/button/CheckButton';
import PlayButton from '@/components/button/PlayButton';
import IconHolder from '@/components/holder/IconHolder';
import Loader from '@/components/loader/Loader';
import { todayAtom, todosAtom } from '@/store/todo';
import { cn } from '@/util/cn';
import { getTime, getTimestamp } from '@/util/date';
import { useAtom, useAtomValue } from 'jotai';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { FaPlus } from 'react-icons/fa';

const ScheduleColumns = () => {
  const [{ data, isFetching, isError, refetch }] = useAtom(todosAtom);
  const today = useAtomValue(todayAtom);

  const schedules = useMemo(() => {
    return data?.filter((todo) => todo.scheduleStart || todo.scheduleEnd);
  }, [data]);

  useEffect(() => {
    let current;

    schedules?.forEach(({ scheduleStart }) => {
      if (scheduleStart && scheduleStart <= today) {
        current = `schedule-column-${getTime(scheduleStart)}`;
      }
    });

    if (current) {
      const currentColumn = document.getElementById(current);
      currentColumn?.scrollIntoView({ block: 'nearest', inline: 'start' });
    }
  }, [schedules]);

  return (
    <ul
      className={cn(
        'w-full flex justify-start overflow-x-scroll [&>*]:scroll-ml-5 scrollbar-hide border-primary border-b-4 px-4'
      )}
    >
      {isFetching && (
        <Loader className="w-full flex justify-center items-center py-4 box-content" />
      )}
      {schedules?.map(
        (
          { icon, subject, title, isDone, history, id, scheduleStart, scheduleEnd },
          i
        ) => {
          const historyTotal = history?.reduce(
            (acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()),
            0
          );

          const checkHandler = async (isDone: boolean) => {
            await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/todo/${id}`, {
              method: 'PATCH',
              body: JSON.stringify({ isDone }),
            });
            refetch();
          };

          const showBottom =
            i === schedules.length - 1 ||
            getTime(schedules[i + 1].scheduleStart) !== getTime(scheduleEnd);

          return (
            <>
              <li
                key={id}
                id={`schedule-column-${getTime(scheduleStart)}`}
                className="relative flex flex-col items-center justify-between w-28 lg:w-32 shrink-0 space-y-4 px-2 py-4 border-gray-200 border-l last:border-r"
              >
                <span className="absolute top-0 left-[-1rem] text-xs text-gray-400 bg-white">
                  {getTime(scheduleStart)}
                </span>
                <div className="flex flex-col space-y-2 items-center">
                  <IconHolder>{icon}</IconHolder>
                  <div className="text-center">
                    <p className="text-xs font-semibold">{subject?.title}</p>
                    <p className="text-sm leading-tight">{title}</p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1">
                    {!isDone && <PlayButton />}
                    <p className="text-sm lg:text-base font-extrabold">
                      {getTimestamp(historyTotal || 0)}
                    </p>
                  </div>
                  <CheckButton checked={!!isDone} onChecked={checkHandler} />
                </div>
              </li>
              {showBottom && (
                <li
                  key={`${id}-blank`}
                  id={`schedule-column-${getTime(scheduleEnd)}`}
                  className="relative border-gray-200 border-l"
                >
                  <span className="absolute top-0 left-[-1rem] text-xs text-gray-400 bg-white">
                    {getTime(scheduleEnd)}
                  </span>
                  {i < schedules.length - 1 && (
                    <div className="h-full flex items-center p-4 rounded-xl">
                      <Link href={``}>
                        <div className="text-gray-300 bg-gray-100 rounded-full flex justify-center items-center text-xs p-1 box-content">
                          <FaPlus />
                        </div>
                      </Link>
                    </div>
                  )}
                </li>
              )}
            </>
          );
        }
      )}
    </ul>
  );
};

export default ScheduleColumns;
