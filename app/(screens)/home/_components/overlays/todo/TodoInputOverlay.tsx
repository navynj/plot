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
import { timesAtom } from '@/store/time';
import { todayAtom, todosAtom } from '@/store/todo';
import { TimeType } from '@/types/time';
import { TodoType } from '@/types/todo';
import { getDashDate, getTime, getTimeState, isValidDate } from '@/util/date';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAtom, useAtomValue } from 'jotai';
import { LexoRank } from 'lexorank';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const formSchema = z.object({
  icon: z.string(),
  title: z.string(),
  subjectId: z.string(),
  content: z.string().optional(),
});

type formSchemaType = z.infer<typeof formSchema>;

const initialTime: timeStateType = {
  hour: '',
  minute: '',
  isAm: true,
};

const TodoInputOverlay = () => {
  const router = useRouter();

  const [today, setToday] = useAtom(todayAtom);
  const [emoji, setEmoji] = useAtom(emojiAtom);
  const subjects = useAtomValue(subjectsAtom);
  const { refetch: refetchTimes } = useAtomValue(timesAtom);
  const { data: todos, refetch: refetchTodos } = useAtomValue(todosAtom);

  const [date, setDate] = useState(today);
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
      const [start, end] = getIntervalFromTimeInput(scheduleStart, scheduleEnd, date);

      let startTime, endTime;
      const prevTodo = todos?.find((item) => item.id === todoId);

      if (start || end) {
        if (start) {
          const startFetchedTimes = await refetchTimes();
          startTime = await getTimeData(
            today,
            start,
            startFetchedTimes.data,
            prevTodo,
            true
          );
          const endFetchedTimes = await refetchTimes();
          endTime = await getTimeData(
            today,
            end,
            endFetchedTimes.data,
            prevTodo,
            false,
            end ? undefined : startTime
          );
        } else {
          const endFetchedTimes = await refetchTimes();
          endTime = await getTimeData(today, end, endFetchedTimes.data, prevTodo, false);
          const startFetchedTimes = await refetchTimes();
          startTime = await getTimeData(
            today,
            start,
            startFetchedTimes.data,
            prevTodo,
            true,
            endTime
          );
        }
      }

      const body = JSON.stringify({
        ...values,
        date: getDashDate(date),
        scheduleStartId: startTime && startTime.id,
        scheduleEndId: endTime && endTime.id,
      });

      if (todoId) {
        await fetch(`${url}/${todoId}`, { method: 'PATCH', body });
      } else {
        await fetch(url, { method: 'POST', body });
      }

      setToday(date);
      refetchTodos();
      refetchTimes();
      closeHandler();
      router.back();
    } catch (error) {
      console.error(error);
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

  const dateChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDate(new Date(event.target.value));
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
        setDate(new Date(todoData.date));
        form.setValue('title', todoData.title || '');
        form.setValue('subjectId', todoData.subject?.id || '');
        form.setValue('content', todoData.content || '');
        setEmoji(todoData.icon || todoData.subject?.icon || '');
        setScheduleStart(getTimeState(todoData.scheduleStart?.time));
        setScheduleEnd(getTimeState(todoData.scheduleEnd?.time));

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
        <YearMonth date={date} />
        <DayDate date={date} />
        <input
          type="date"
          onChange={dateChangeHandler}
          value={getDashDate(date)}
          className="absolute bottom-0 left-0 h-full opacity-0"
        />
        <input
          type="date"
          onChange={dateChangeHandler}
          value={getDashDate(date)}
          className="absolute bottom-0 right-0 h-full opacity-0"
        />
      </div>
      <div className="flex gap-3">
        <EmojiInput params={`&todo-input =show&subjectId=${subjectId}&todoId=${todoId}`}>
          <input {...form.register('icon')} hidden />
        </EmojiInput>
        <div className="flex flex-col justify-between gap-2 min-w-0 [&>*]:bg-gray-100 [&>*]:px-2 [&>*]:py-2.5 [&>*]:rounded-lg">
          <select {...form.register('subjectId')} className="h-full">
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
      <div>
        <div className="mb-2 flex justify-between items-center">
          <h6 className="font-extrabold">Log</h6>
        </div>
        <textarea
          className="w-full p-2.5 text-sm bg-gray-100 rounded-lg"
          {...form.register('content')}
        />
      </div>
      {error && (
        <div className="w-full p-2 text-sm bg-red-50 text-red-400 font-bold text-center rounded-lg">
          {error.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </OverlayForm>
  );
};

const getTimeData = async (
  today: Date,
  time: Date | null,
  times?: TimeType[],
  prevTodo?: TodoType,
  isStart?: boolean,
  linkedTime?: TimeType
) => {
  const timeIdx = times?.findIndex((item) => {
    if (time) {
      return getTime(item.time) === getTime(time);
    }
  });

  // 동일한 값의 time이 이미 존재할 경우
  if (times && timeIdx && timeIdx > -1) {
    // Todo의 기존 스케줄을 이미 존재하는 time으로 수정하는 경우
    if (
      isStart &&
      prevTodo?.scheduleStart &&
      getTime(prevTodo?.scheduleStart.time) !== getTime(time)
    ) {
      await deleteTime(prevTodo.scheduleStart.id);
    } else if (
      !isStart &&
      prevTodo?.scheduleEnd &&
      getTime(prevTodo?.scheduleEnd.time) !== getTime(time)
    ) {
      await deleteTime(prevTodo.scheduleEnd.id);
    }
    return times[timeIdx];
  } else if (isStart && prevTodo?.scheduleStart) {
    // start 수정 시 기존 time 존재할 경우
    const { scheduleStart: prevStart } = prevTodo;
    if (prevStart.endTodo) {
      // 기존 time 앞에 Todo가 배치되어있을 경우
      if (time && isValidDate(time)) {
        const rank = getNewTimeRank(time, times, false);
        return await createTime(today, time, rank);
      } else {
        const rank = getNextTimeRank(prevStart.rank, times);
        return await createTime(today, time, rank);
      }
    } else {
      // 기존 time 앞에 Todo가 없을 경우
      return await patchTime(prevStart.id, time);
    }
  } else if (!isStart && prevTodo?.scheduleEnd) {
    // end 수정 시 기존 time 존재할 경우
    const { scheduleEnd: prevEnd } = prevTodo;
    // 기존 time 앞에 Todo가 배치되어있을 경우
    if (prevEnd.startTodo) {
      if (time && isValidDate(time)) {
        const rank = getNewTimeRank(time, times, true);
        return await createTime(today, time, rank);
      } else {
        const rank = getPrevTimeRank(prevEnd.rank, times);
        return await createTime(today, time, rank);
      }
    } else {
      // 기존 time 앞에 Todo가 없을 경우
      return await patchTime(prevEnd.id, time);
    }
  } else if (time && isValidDate(time)) {
    // 값이 존재하는 time을 새로 만들 경우
    const rank = getNewTimeRank(time, times);
    return await createTime(today, time, rank);
  } else if (linkedTime) {
    // 값이 없는 time을 이전/이후 시간에 연결하여 생성할 경우
    let rank;
  } else {
    // 값이 없는 time을 연결 없이 새로 만들 경우 -> 가장 마지막에 추가
    let rank;
    if (!times || times.length === 0) {
      rank = LexoRank.middle();
    } else {
      rank = times[times.length - 1].rank.genNext();
    }

    return await createTime(today, time, rank);
  }
};

const getNewTimeRank = (time: Date, times?: TimeType[], isEnd?: boolean) => {
  let rank;
  let idx = -1;

  if (times) {
    times.forEach((item, i) => {
      if (!item.time) {
        return;
      }

      if (item.time <= time) {
        idx = i;
      }
    });
  }

  if (!times || times.length === 0) {
    // 빈 배열에 새로 추가
    rank = LexoRank.middle();
  } else if (idx === -1 || (idx === 0 && isEnd)) {
    // 맨 앞에 새로 추가
    rank = times[0].rank.genPrev();
  } else if (idx === times.length - 1) {
    // 마지막에 새로 추가
    rank = times[times.length - 1].rank.genNext();
  } else {
    if (isEnd) {
      // 사이에 새로 추가 - 기존 시간 앞에
      rank = times[idx - 1]?.rank.between(times[idx].rank);
    } else {
      // 사이에 새로 추가 - 기존 시간 뒤에
      rank = times[idx]?.rank.between(times[idx + 1].rank);
    }
  }

  return rank;
};

const getNextTimeRank = (targetRank: LexoRank, times?: TimeType[]) => {
  if (!times) {
    return LexoRank.middle();
  }

  const targetIdx = times.findIndex(
    (time) => time.rank.toString() === targetRank.toString()
  );

  if (targetIdx === -1) {
    throw new Error('Time not exists (rank: ' + targetRank.toString() + ')');
  }

  if (times.length === 0) {
    return LexoRank.middle();
  } else if (targetIdx === times.length - 1) {
    return times[targetIdx].rank.genNext();
  } else {
    return times[targetIdx].rank.between(times[targetIdx + 1].rank);
  }
};

const getPrevTimeRank = (targetRank: LexoRank, times?: TimeType[]) => {
  if (!times) {
    return LexoRank.middle();
  }

  const targetIdx = times.findIndex(
    (time) => time.rank.toString() === targetRank.toString()
  );

  if (targetIdx === -1) {
    throw new Error('Time not exists (rank: ' + targetRank.toString() + ')');
  }

  if (times.length === 0) {
    return LexoRank.middle();
  } else if (targetIdx === 0) {
    return times[targetIdx].rank.genPrev();
  } else {
    return times[targetIdx - 1].rank.between(times[targetIdx].rank);
  }
};

const createTime = async (today: Date, time: Date | null, rank: LexoRank) => {
  const timeResponse = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/time', {
    method: 'POST',
    body: JSON.stringify({
      date: getDashDate(today),
      time: time && isValidDate(time) ? time.toISOString() : null,
      rank: rank.toString(),
    }),
  });

  return await timeResponse.json();
};

const patchTime = async (id: string, time: Date | null) => {
  const timeResponse = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/time/' + id, {
    method: 'PATCH',
    body: JSON.stringify({
      time: time && isValidDate(time) ? time.toISOString() : null,
    }),
  });

  return await timeResponse.json();
};

const deleteTime = async (id: string) => {
  const timeResponse = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/time/' + id, {
    method: 'DELETE',
  });

  return await timeResponse.json();
};

export default TodoInputOverlay;
