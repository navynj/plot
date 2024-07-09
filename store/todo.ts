import { TodoType } from '@/types/todo';
import { getDashDate } from '@/util/date';
import { atom } from 'jotai';
import { atomWithQuery } from 'jotai-tanstack-query';
import { LexoRank } from 'lexorank';

export const todayAtom = atom(new Date());

export const todosAtom = atomWithQuery<TodoType[]>((get) => {
  return {
    queryKey: ['todos', get(todayAtom)],
    queryFn: async ({ queryKey: [, today] }) => {
      const res = await fetch(
        process.env.NEXT_PUBLIC_BASE_URL + `/api/todo?date=${getDashDate(today as Date)}`
      );
      const todos = await res.json();

      return todos.map((todo: any) => ({
        ...todo,
        scheduleStart: todo.scheduleStart && {
          ...todo.scheduleStart,
          time: todo.scheduleStart && new Date(todo.scheduleStart.time),
          rank: LexoRank.parse(todo.scheduleStart.rank),
        },
        scheduleEnd: todo.scheduleEnd && {
          ...todo.scheduleEnd,
          time: todo.scheduleEnd && new Date(todo.scheduleEnd.time),
          rank: LexoRank.parse(todo.scheduleEnd.rank),
        },
      }));
    },
  };
});
