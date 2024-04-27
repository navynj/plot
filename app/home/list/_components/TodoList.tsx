'use client';

import CheckButton from '@/components/button/CheckButton';
import OptionButton from '@/components/button/OptionButton';
import PlayButton from '@/components/button/PlayButton';
import IconHolder from '@/components/holder/IconHolder';
import Loader from '@/components/loader/Loader';
import { todosAtom } from '@/store/todo';
import { getTime, getTimestamp } from '@/util/date';
import { useAtom } from 'jotai';

const TodoList = () => {
  const [{ data, isPending, isError }] = useAtom(todosAtom);
  return (
    <ol className="flex flex-col items-center">
      {isPending && (
        <div className="p-16">
          <Loader />
        </div>
      )}
      {data?.map(
        ({
          id,
          title,
          icon,
          thumbnail,
          subjectIcon,
          subjectTitle,
          scheduleStart,
          scheduleEnd,
          history,
        }) => {
          const historyTotal = history?.reduce(
            (acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()),
            0
          );

          return (
            <li
              key={id}
              className="w-full flex space-x-4 p-4 justify-between items-center"
            >
              <span>=</span>
              <div className="flex w-full justify-between items-center">
                <div className="flex items-center gap-2">
                  <PlayButton />
                  {icon && !thumbnail && <IconHolder>{icon}</IconHolder>}
                  {!icon && !thumbnail && <IconHolder>{subjectIcon}</IconHolder>}
                  <div>
                    <p className="text-xs font-semibold">{subjectTitle}</p>
                    <p className="text-sm lg:text-base">{title}</p>
                  </div>
                </div>
                <div className="text-center shrink-0">
                  <p className="text-sm lg:text-base font-semibold">
                    {getTimestamp(historyTotal || 0)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {scheduleStart &&
                      scheduleEnd &&
                      `/${getTime(scheduleStart)}~${getTime(scheduleEnd)}`}
                  </p>
                </div>
              </div>
              <CheckButton />
              <OptionButton
                menu={[
                  { name: 'Edit Todo', action: () => {} },
                  { name: 'Delete Todo', action: () => {} },
                ]}
              />
            </li>
          );
        }
      )}
    </ol>
  );
};

export default TodoList;
