'use client';

import DayDate from '@/components/date/DayDate';
import YearMonth from '@/components/date/YearMonth';
import EmojiInput from '@/components/emoji/EmojiInput';
import OverlayForm from '@/components/overlay/OverlayForm';
import { emojiAtom, isEmojiSelectedAtom } from '@/store/emoji';
import { subjectsAtom } from '@/store/subject';
import { todayAtom, todosAtom } from '@/store/todo';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const formSchema = z.object({
  title: z.string(),
  subjectId: z.string(),
});

const TodoInputOverlay = () => {
  const dateInput = useRef<HTMLInputElement>(null);

  const [today, setToday] = useAtom(todayAtom);
  const subjects = useAtomValue(subjectsAtom);
  const setEmoji = useSetAtom(emojiAtom);
  const [isEmojiSelected, setEmojiSelect] = useAtom(isEmojiSelectedAtom);
  const [{ refetch: refetchTodos }] = useAtom(todosAtom);

  const params = useSearchParams();
  const defaultSubjectId = params.get('subject') || '';
  const showOverlay = params.get('todo-input');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      subjectId: defaultSubjectId,
    },
  });

  const submitHandler = async (values: z.infer<typeof formSchema>) => {
    await fetch(
      process.env.NEXT_PUBLIC_BASE_URL + `/api/todo`, {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          date: today.toISOString(),
        })
      }
    );

    refetchTodos();
  }

  const showDatepickerHandler = () => {
    dateInput.current?.showPicker();
  };

  const dateChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setToday(new Date(event.target.value));
  };

  const closeHandler = () => {
    setEmoji('');
    setEmojiSelect(false);
  }

  // 주제 선택 시 subjectID 쿼리 파라미터 값에 따라  기본값 세팅
  useEffect(() => {
    form.setValue('subjectId', defaultSubjectId);
  }, [defaultSubjectId]);

  // NOTE: 주제 이모지를 기본 이모지값으로 세팅
  const subjectId = form.watch('subjectId');

  useEffect(() => {
    if (showOverlay && !isEmojiSelected) {
      const subject = subjects.data?.find((item) => item.id === subjectId);      
      setEmoji(subject?.icon || '');
    }
  }, [showOverlay, subjectId, subjects, setEmoji, isEmojiSelected]);

  return (
    <OverlayForm<z.infer<typeof formSchema>> id="todo-input" form={form} onSubmit={submitHandler} onClose={closeHandler} isRight={true}>
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
        <EmojiInput />
        <div className="flex flex-col justify-between w-full [&>*]:bg-gray-100 [&>*]:px-2 [&>*]:py-2.5 [&>*]:rounded-lg">
          <select {...form.register('subjectId')} >
            <option value="">주제 없음</option>
            {subjects.data?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <input placeholder='Enter the title' {...form.register('title')} />
        </div>
      </div>
    </OverlayForm>
  );
};

export default TodoInputOverlay;

