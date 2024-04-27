import { TodoType } from '@/types/todo';
import { getDashDate } from '@/util/date';
import { atom } from 'jotai';
import { atomWithQuery } from 'jotai-tanstack-query';

export const todayAtom = atom(new Date(2024, 3, 25));

export const todosAtom = atomWithQuery<TodoType[]>((get) => {
  return {
    queryKey: ['todos', get(todayAtom)],
    queryFn: async ({ queryKey: [, today] }) => {
      const res = await fetch(
        process.env.NEXT_PUBLIC_BASE_URL + `/api/todo?date=${getDashDate(today as Date)}`
      );
      return res.json();
    },
  };
});
