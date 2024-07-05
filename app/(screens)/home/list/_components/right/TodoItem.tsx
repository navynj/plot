'use client';

import CheckButton from '@/components/button/CheckButton';
import OptionButton from '@/components/button/OptionButton';
import PlayButton from '@/components/button/PlayButton';
import IconHolder from '@/components/holder/IconHolder';
import { todosAtom } from '@/store/todo';
import { TodoType } from '@/types/todo';
import { getTime, getTimestamp } from '@/util/date';
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';

const TodoItem = ({
  id,
  thumbnail,
  subject,
  title,
  icon,
  scheduleStart,
  scheduleEnd,
  history,
  isDone,
}: TodoType) => {
  const [{ refetch }] = useAtom(todosAtom);
  const router = useRouter();

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

  return (
    <li key={id} className="w-full flex space-x-2 justify-between items-center">
      <div className="flex w-full justify-between items-center">
        <div className="flex items-center gap-2">
          {!isDone && <PlayButton />}
          {icon && !thumbnail && (
            <IconHolder className="w-10 h-10 shrink-0">
              {icon || subject?.icon}
            </IconHolder>
          )}
          <div>
            <p className="text-xs font-semibold break-words">{subject?.title}</p>
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
      <CheckButton checked={!!isDone} onChecked={checkHandler} />
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
              await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/todo/${id}`, {
                method: 'DELETE',
              });
              await refetch();
            },
          },
        ]}
      />
    </li>
  );
};

export default TodoItem;
