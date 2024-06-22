'use client';

import DayDate from '@/components/date/DayDate';
import YearMonth from '@/components/date/YearMonth';
import EmojiInput from '@/components/emoji/EmojiInput';
import TimeInput, {
  getIntervalFromTimeInput,
  timeStateType,
} from '@/components/input/TimeInput';
import OverlayForm from '@/components/overlay/OverlayForm';
import { emojiAtom } from '@/store/emoji';
import { subjectsAtom } from '@/store/subject';
import { todayAtom, todosAtom } from '@/store/todo';
import { getDashDate, getTimeState } from '@/util/date';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAtom, useAtomValue } from 'jotai';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const formSchema = z.object({
  icon: z.string(),
  title: z.string(),
  subjectId: z.string(),
});

type formSchemaType = z.infer<typeof formSchema>;

const initialTime: timeStateType = {
  hour: '',
  minute: '',
  isAm: true,
};

const TodoInputOverlay = () => {
  const router = useRouter();

  const dateLeftInput = useRef<HTMLInputElement>(null);
  const dateRightInput = useRef<HTMLInputElement>(null);

  const [today, setToday] = useAtom(todayAtom);
  const [emoji, setEmoji] = useAtom(emojiAtom);
  const subjects = useAtomValue(subjectsAtom);
  const { data: todos, refetch: refetchTodos } = useAtomValue(todosAtom);

  const [scheduleStart, setScheduleStart] = useState(initialTime);
  const [scheduleEnd, setScheduleEnd] = useState(initialTime);
  const [isSubjectEmoji, setIsSubjectEmoji] = useState(false);
  const [error, setError] = useState('');

  const params = useSearchParams();
  const defaultSubjectId = params.get('subjectId') || '';
  const todoId = params.get('todoId') || '';
  const showOverlay = params.get('todo-input') || '';

  const form = useForm<formSchemaType>({
    resolver: zodResolver(formSchema),
  });

  const submitHandler = async (values: formSchemaType) => {
    setError('');

    const url = process.env.NEXT_PUBLIC_BASE_URL + '/api/todo';

    try {
      const interval = getIntervalFromTimeInput(scheduleStart, scheduleEnd, today);

      const body = JSON.stringify({
        ...values,
        date: today.toISOString(),
        scheduleStart: interval && interval[0] && interval[0].toISOString(),
        scheduleEnd: interval && interval[1] && interval[1].toISOString(),
      });

      if (todoId) {
        await fetch(`${url}/${todoId}`, { method: 'PATCH', body });
      } else {
        await fetch(url, { method: 'POST', body });
      }

      refetchTodos();
      closeHandler();
      router.back();
    } catch (error) {
      if (typeof error === 'string') {
        setError(error);
      } else if ((error as Error)?.message) {
        setError((error as Error).message);
      } else {
        console.error(error);
      }
      return;
    }
  };

  const showLeftDatepickerHandler = () => {
    dateLeftInput.current?.showPicker();
  };

  const showRightDatepickerHandler = () => {
    dateRightInput.current?.showPicker();
  };

  const dateChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setToday(new Date(event.target.value));
  };

  const clearTimeHandler = () => {
    setScheduleStart(initialTime);
    setScheduleEnd(initialTime);
    setError('');
  };

  const closeHandler = () => {
    clearTimeHandler();
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
        setScheduleStart(getTimeState(todoData.scheduleStart));
        setScheduleEnd(getTimeState(todoData.scheduleEnd));

        if (todoData.icon === todoData.subject?.icon || !todoData.icon) {
          setIsSubjectEmoji(true);
        }
      } else if (!todoData) {
        setIsSubjectEmoji(true);
        form.reset();
        form.setValue('subjectId', defaultSubjectId);
        setTimeout(() => {
          form.setFocus('title');
        }, 50);
      }
    } else {
      setIsSubjectEmoji(false);
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
  }, [subjectId, isSubjectEmoji, subjects]);

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
      onClose={closeHandler}
      isRight={true}
      disableReset={true}
      disalbeBackOnSubmit={true}
      className="flex flex-col gap-8"
    >
      <div className="relative flex justify-between items-center cursor-pointer">
        <YearMonth onClick={showLeftDatepickerHandler} date={today} />
        <DayDate onClick={showRightDatepickerHandler} date={today} />
        <input
          ref={dateLeftInput}
          type="date"
          onChange={dateChangeHandler}
          value={getDashDate(today)}
          className="absolute bottom-0 left-0 invisible"
        />
        <input
          ref={dateRightInput}
          type="date"
          onChange={dateChangeHandler}
          value={getDashDate(today)}
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
      <div>
        <div className="mb-2 flex justify-between items-center">
          <h6 className="font-extrabold">Schedule</h6>
          <button
            type="button"
            onClick={clearTimeHandler}
            className="px-2 text-xs font-extrabold"
          >
            Clear
          </button>
        </div>
        <div className="flex justify-between items-center text-sm">
          <TimeInput time={scheduleStart} setTime={setScheduleStart} />
          <span>~</span>
          <TimeInput time={scheduleEnd} setTime={setScheduleEnd} />
        </div>
      </div>
      {error && (
        <div className="w-full p-2 text-sm bg-red-50 text-red-400 font-bold text-center rounded-lg">
          {error}
        </div>
      )}
    </OverlayForm>
  );
};

export default TodoInputOverlay;
