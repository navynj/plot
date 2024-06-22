'use client';

import CheckButton from '@/components/button/CheckButton';
import OptionButton from '@/components/button/OptionButton';
import PlayButton from '@/components/button/PlayButton';
import IconHolder from '@/components/holder/IconHolder';
import Loader from '@/components/loader/Loader';
import { todosAtom } from '@/store/todo';
import { getTime, getTimestamp } from '@/util/date';
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TodoList = () => {
  const router = useRouter();
  const [{ data, isPending, isFetching, refetch, isError }] = useAtom(todosAtom);
  const [deletedTodoId, setDeletedTodoId] = useState('');

  return (
    <ol className="flex flex-col items-center px-4 py-6 space-y-3 pb-16">
      {data?.map(
        ({
          id,
          title,
          icon,
          thumbnail,
          subject,
          scheduleStart,
          scheduleEnd,
          history,
        }) => {
          const historyTotal = history?.reduce(
            (acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()),
            0
          );

          if (id === deletedTodoId) {
            return;
          }

          return (
            <li key={id} className="w-full flex space-x-2 justify-between items-center">
              <div className="flex w-full justify-between items-center">
                <div className="flex items-center gap-2">
                  <PlayButton />
                  {icon && !thumbnail && (
                    <IconHolder className="w-10 h-10">{icon}</IconHolder>
                  )}
                  {!icon && !thumbnail && (
                    <IconHolder className="w-10 h-10">{subject?.icon}</IconHolder>
                  )}
                  <div>
                    <p className="text-xs font-semibold">{subject?.title}</p>
                    <p className="text-sm lg:text-base">{title}</p>
                  </div>
                </div>
                <div className="text-center shrink-0">
                  <p className="text-[0.75rem] lg:text-base font-semibold">
                    {getTimestamp(historyTotal || 0)}
                  </p>
                  <p className="text-[0.625rem] text-gray-400">
                    {scheduleStart &&
                      scheduleEnd &&
                      `/${getTime(scheduleStart)}~${getTime(scheduleEnd)}`}
                  </p>
                </div>
              </div>
              <CheckButton />
              <OptionButton
                menu={[
                  {
                    name: 'Edit Todo',
                    action: () => {
                      router.push(`/home/list?todo-input=show&todoId=${id}`);
                    },
                  },
                  {
                    name: 'Delete Todo',
                    action: async () => {
                      setDeletedTodoId(id);
                      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/todo/${id}`, {
                        method: 'DELETE',
                      });
                      await refetch();
                      setDeletedTodoId('');
                    },
                  },
                ]}
              />
            </li>
          );
        }
      )}
      {isPending ||
        (isFetching && (
          <div className="p-16">
            <Loader />
          </div>
        ))}
    </ol>
  );
};

export default TodoList;
