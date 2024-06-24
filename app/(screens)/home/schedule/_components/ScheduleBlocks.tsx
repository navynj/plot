'use client';

import CheckButton from '@/components/button/CheckButton';
import OptionButton from '@/components/button/OptionButton';
import IconHolder from '@/components/holder/IconHolder';
import Loader from '@/components/loader/Loader';
import { todosAtom } from '@/store/todo';
import { getTime, getTimestamp } from '@/util/date';
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';

const ScheduleBlocks = () => {
  const router = useRouter();

  const [{ data: todos, isFetching, refetch, isError }] = useAtom(todosAtom);

  return (
    <>
      <ul className="flex flex-col items-center space-y-2">
        {todos?.map(
          (
            { id, icon, thumbnail, subject, title, history, scheduleStart, scheduleEnd },
            i
          ) => {
            const historyTotal = history?.reduce(
              (acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()),
              0
            );

            let duration = 0;
            if (scheduleStart && scheduleEnd) {
              duration =
                (scheduleEnd.getTime() - scheduleStart!.getTime()) / 10000 / 60 / 6;
            }

            const showBottom =
              i === todos.length - 1 ||
              getTime(todos[i + 1].scheduleStart) !== getTime(scheduleEnd);

            return (
              <>
                <li key={id} className="flex gap-2 justify-between">
                  <div className="mt-[-0.5rem] pb-2 box-border">
                    <p className="text-xs font-extrabold mb-2">
                      {getTime(scheduleStart)}
                    </p>
                    <div className="w-1/2 h-[calc(100%-1.5rem)] border-r border-black" />
                  </div>
                  <div
                    style={{
                      minHeight:
                        (duration < 1 ? 60 : duration === 1 ? 80 : duration * 60) + 'px',
                    }}
                    className={`w-80 flex space-x-2 justify-between items-center bg-gray-100 p-4 rounded-xl`}
                  >
                    <div className="w-full flex justify-between items-center">
                      <div className="flex w-full justify-between items-center">
                        <div className="flex items-center gap-2">
                          {icon && !thumbnail && (
                            <IconHolder className="w-10 h-10 shrink-0 bg-white">
                              {icon || subject?.icon}
                            </IconHolder>
                          )}
                          <div>
                            <p className="text-xs font-semibold break-words">
                              {subject?.title}
                            </p>
                            <p className="text-sm lg:text-base">{title}</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-gray-300">
                        {getTimestamp(historyTotal || 0)}
                      </p>
                    </div>
                    <CheckButton className="bg-white" checkedCheckClass="text-black" />
                    <OptionButton
                      menu={[
                        {
                          name: 'Edit Todo',
                          action: () => {
                            router.push(`/home/schedule?todo-input=show&todoId=${id}`);
                          },
                        },
                        {
                          name: 'Delete Todo',
                          action: async () => {
                            await fetch(
                              `${process.env.NEXT_PUBLIC_BASE_URL}/api/todo/${id}`,
                              {
                                method: 'DELETE',
                              }
                            );
                            await refetch();
                          },
                        },
                      ]}
                    />
                  </div>
                </li>
                {showBottom && (
                  <li key={`${id}-bottom`} className="w-full flex gap-2 justify-between">
                    <span className="mt-[-0.5rem] text-xs font-extrabold">
                      {getTime(scheduleEnd)}
                    </span>
                    {i < todos.length - 1 && (
                      <div className="w-80 bg-gray-100 p-4 rounded-xl" />
                    )}
                  </li>
                )}
              </>
            );
          }
        )}
      </ul>
      {isFetching && (
        <div className="p-16 flex justify-center">
          <Loader />
        </div>
      )}
    </>
  );
};

export default ScheduleBlocks;
