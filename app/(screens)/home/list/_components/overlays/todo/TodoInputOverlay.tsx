'use client';

import DayDate from '@/components/date/DayDate';
import YearMonth from '@/components/date/YearMonth';
import EmojiInput from '@/components/emoji/EmojiInput';
import OverlayForm from '@/components/overlay/OverlayForm';
import { emojiAtom, isEmojiSelectedAtom } from '@/store/emoji';
import { subjectsAtom } from '@/store/subject';
import { todayAtom } from '@/store/todo';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';


const TodoInputOverlay = () => {
  const router = useRouter();

  const dateInput = useRef<HTMLInputElement>(null);

  const [today, setToday] = useAtom(todayAtom);
  const subjects = useAtomValue(subjectsAtom);
  const setEmoji = useSetAtom(emojiAtom);
  const [isEmojiSelected, setEmojiSelect] = useAtom(isEmojiSelectedAtom);

  const params = useSearchParams();
  const subjectId = params.get('subject');
  const showOverlay = params.get('todo-input');

  // NOTE: 주제 이모지를 기본 이모지값으로 세팅
  useEffect(() => {
    if (showOverlay && !isEmojiSelected) {
      const subject = subjects.data?.find((item) => item.id === subjectId);      
      setEmoji(subject?.icon || '');
    }
  }, [showOverlay, subjectId, subjects, setEmoji, isEmojiSelected]);

  const showDatepickerHandler = () => {
    dateInput.current?.showPicker();
  };

  const dateChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setToday(new Date(event.target.value));
  };

  const subjectSelectHandler = (event: React.ChangeEvent<HTMLSelectElement>) => {
    router.replace(`/home/list?todo-input=show&subject=${event.target.value}`);
  }

  const closeHandler = () => {
    setEmoji('');
    setEmojiSelect(false);
  }

  return (
    <OverlayForm id="todo-input" isRight={true} onClose={closeHandler}>
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
          <select value={subjectId || ''} onChange={subjectSelectHandler}>
            <option value="">주제 없음</option>
            {subjects.data?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <input placeholder='Enter the title' />
        </div>
      </div>
    </OverlayForm>
  );
};

export default TodoInputOverlay;
