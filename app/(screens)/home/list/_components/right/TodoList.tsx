'use client';

import Loader from '@/components/loader/Loader';
import { todosAtom } from '@/store/todo';
import { useAtom } from 'jotai';
import { useMemo } from 'react';
import TodoItem from './TodoItem';

const TodoList = () => {
  const [{ data, isPending, isFetching, isError }] = useAtom(todosAtom);

  const todos = useMemo(() => {
    return data?.filter((todo) => !todo.isDone)
  }, [data]);

  return (
    todos && todos.length > 0 && (
      <ol className="flex flex-col items-center px-4 py-6 space-y-3">
        {todos.map((todo) => <TodoItem key={todo.id} {...todo} />)}
        {isPending ||
          (isFetching && (
            <div className="p-16">
              <Loader />
            </div>
          ))}
      </ol>
    )
  );
};

export default TodoList;
