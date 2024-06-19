'use client';

import DayDate from '@/components/date/DayDate';
import YearMonth from '@/components/date/YearMonth';
import EmojiInput from '@/components/emoji/EmojiInput';
import OverlayForm from '@/components/overlay/OverlayForm';
import { emojiAtom } from '@/store/emoji';
import { subjectsAtom } from '@/store/subject';
import { todayAtom, todosAtom } from '@/store/todo';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAtom, useAtomValue } from 'jotai';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const formSchema = z.object({
  icon: z.string(),
  title: z.string(),
  subjectId: z.string(),
});

type formSchemaType = z.infer<typeof formSchema>;

const TodoInputOverlay = () => {
  const dateInput = useRef<HTMLInputElement>(null);

  const [today, setToday] = useAtom(todayAtom);
  const [emoji, setEmoji] = useAtom(emojiAtom);
  const subjects = useAtomValue(subjectsAtom);
  const { data: todos, refetch: refetchTodos } = useAtomValue(todosAtom);

  const [isSubjectEmoji, setIsSubjectEmoji] = useState(false);

  const params = useSearchParams();
  const defaultSubjectId = params.get('subjectId') || '';
  const todoId = params.get('todoId') || '';
  const showOverlay = params.get('todo-input') || '';

  const form = useForm<formSchemaType>({
    resolver: zodResolver(formSchema),
  });

  const submitHandler = async (values: formSchemaType) => {
    const url = process.env.NEXT_PUBLIC_BASE_URL + '/api/todo';
    const body = JSON.stringify({
      ...values,
      date: today.toISOString(),
    });

    if (todoId) {
      await fetch(`${url}/${todoId}`, { method: 'PATCH', body });
    } else {
      await fetch(url, { method: 'POST', body });
    }

    refetchTodos();
  };

  const showDatepickerHandler = () => {
    dateInput.current?.showPicker();
  };

  const dateChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setToday(new Date(event.target.value));
  };

  // Todo 수정 시 기본값 세팅
  useEffect(() => {
    if (showOverlay) {
      const todoData = todos?.find((item) => item.id === todoId);
      if (todoData && todoData.date) {
        setToday(new Date(todoData.date));
        form.setValue('title', todoData.title || '');
        form.setValue('subjectId', todoData.subject?.id || '');
        setEmoji(todoData.icon || todoData.subject?.icon || '');

        if (todoData.icon === todoData.subject?.icon || !todoData.icon) {
          setIsSubjectEmoji(true);
        }
      } else if (!todoData) {
        setIsSubjectEmoji(true);
        form.reset();
        form.setValue('subjectId', defaultSubjectId);
      }
    }
  }, [showOverlay, todoId, defaultSubjectId, todos]);

  // Subject 변경 시 이모지 업데이트 (단, 사용자가 설정하지 않았을 경우)
  const subjectId = form.watch('subjectId');

  useEffect(() => {
    if (isSubjectEmoji) {
      const subject = subjects.data?.find((item) => item.id === subjectId);
      form.setValue('icon', subject?.icon || '');
      setEmoji(subject?.icon || '');
    }
  }, [subjectId, isSubjectEmoji]);

  // Emoji 선택값으로 업데이트
  useEffect(() => {
    const subject = subjects.data?.find((item) => item.id === subjectId);

    if (showOverlay) {
      if (emoji) {
        form.setValue('icon', emoji);
        if (emoji !== subject?.icon) {
          setIsSubjectEmoji(false);
        }
      } else {
        form.setValue('icon', subject?.icon || '');
        setEmoji(subject?.icon || '');
        setIsSubjectEmoji(true);
      }
    }
  }, [emoji]);

  return (
    <OverlayForm<formSchemaType>
      id="todo-input"
      form={form}
      onSubmit={submitHandler}
      isRight={true}
      disableReset={true}
    >
      <div
        onClick={showDatepickerHandler}
        className="mb-8 relative flex justify-between items-center cursor-pointer"
      >
        <YearMonth date={today} />
        <DayDate date={today} />
        <input
          ref={dateInput}
          type="date"
          onChange={dateChangeHandler}
          className="absolute bottom-0 right-0 invisible"
        />
      </div>
      <div className="flex gap-3">
        <EmojiInput params={`&todo-input=show&subjectId=${subjectId}&todoId=${todoId}`}>
          <input {...form.register('icon')} hidden />
        </EmojiInput>
        <div className="flex flex-col justify-between w-full [&>*]:bg-gray-100 [&>*]:px-2 [&>*]:py-2.5 [&>*]:rounded-lg">
          <select {...form.register('subjectId')}>
            <option value="">주제 없음</option>
            {subjects.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <input placeholder="Enter the title" {...form.register('title')} />
        </div>
      </div>
    </OverlayForm>
  );
};

export default TodoInputOverlay;
