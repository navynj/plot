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

      let startTime: TimeType | undefined = undefined;
      let endTime: TimeType | undefined = undefined;
      let startFetchedTimes, endFetchedTimes;
      const prevTodo = todos?.find((item) => item.id === todoId);

      try {
        if (start || end) {
          if (start) {
            startFetchedTimes = await refetchTimes();
            startTime = await getTimeData(
              today,
              start,
              startFetchedTimes.data,
              prevTodo,
              true
            );
            endFetchedTimes = await refetchTimes();
            endTime = await getTimeData(
              today,
              end,
              endFetchedTimes.data,
              prevTodo,
              false,
              end ? undefined : startTime
            );
          } else {
            endFetchedTimes = await refetchTimes();
            endTime = await getTimeData(
              today,
              end,
              endFetchedTimes.data,
              prevTodo,
              false
            );
            startFetchedTimes = await refetchTimes();
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
          const response = await fetch(`${url}/${todoId}`, { method: 'PATCH', body });
          if (!response.ok) {
            throw new Error(response.status + ' ' + response.statusText);
          }
        } else {
          const response = await fetch(url, { method: 'POST', body });
          if (!response.ok) {
            throw new Error(response.status + ' ' + response.statusText);
          }
        }

        setToday(date);
        refetchTodos();
        refetchTimes();
        closeHandler();
        router.back();
      } catch (error) {
        // 에러 발생 시 새로 생성된 time 제거
        if (
          startTime?.rank &&
          startFetchedTimes?.data &&
          -1 ===
            startFetchedTimes.data.findIndex(
              (time) => time.rank.toString() === startTime?.rank.toString()
            )
        ) {
          await deleteTime(startTime.id);
        }
        if (
          endTime?.rank &&
          endFetchedTimes?.data &&
          -1 ===
            endFetchedTimes.data.findIndex(
              (time) => time.rank.toString() === endTime?.rank.toString()
            )
        ) {
          await deleteTime(endTime.id);
        }
        refetchTimes();

        throw error;
      }
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
  if (!times) {
    throw new Error('Fail to get time list');
  }

  if (!time || !isValidDate(time)) {
    // 1. 빈 값일 경우
    return await getBlankTimeDate(time, today, times, isStart, linkedTime, prevTodo);
  }

  const timeIdx = times.findIndex((item) => {
    return getTime(item.time) === getTime(time);
  });
  if (timeIdx > -1) {
    // 2. 기존 값이 존재할 경우 - Todo를 갖고 있지 않은 시간일 경우 반환, 이외 에러
    if (
      !prevTodo &&
      ((isStart && times[timeIdx].startTodo) || (!isStart && times[timeIdx].endTodo))
    ) {
      throw new Error('Time conflict: Existing time has already got todos');
    }

    if (prevTodo) {
      if (
        isStart &&
        prevTodo.scheduleStart &&
        !prevTodo.scheduleStart.endTodo &&
        getTime(prevTodo.scheduleStart.time) !== getTime(time)
      ) {
        // TODO: 주석 추가
        await deleteTime(prevTodo.scheduleStart.id);
      }

      if (
        !isStart &&
        prevTodo.scheduleEnd &&
        prevTodo.scheduleEnd.startTodo &&
        getTime(prevTodo.scheduleEnd.time) !== getTime(time)
      ) {
        // TODO: 주석 추가
        await deleteTime(prevTodo.scheduleEnd.id);
      }
    }

    return times[timeIdx];
  } else {
    // 3. 새로운 값일 경우
    if (prevTodo) {
      // 3-1. 수정
      if (isStart && prevTodo.scheduleStart) {
        // 3-1-1. 이전 start 값이 존재
        if (prevTodo.scheduleStart.endTodo) {
          // 3-1-1-1. 이전 start 값에 endTodo가 존재 - 생성
          const rank = await getNewTimeRank(today, time, times, isStart, prevTodo);
          return await createTime(today, time, rank);
        } else {
          // 3-1-1-2. 이전 start 값이 비어있음 - 수정
          return await patchTime(prevTodo.scheduleStart.id, time);
        }
      }

      if (!isStart && prevTodo.scheduleEnd) {
        // 3-1-1. 이전 end 값이 존재
        if (prevTodo.scheduleEnd.startTodo) {
          // 3-1-1-1. 이전 start 값에 startTodo가 존재 - 생성
          const rank = await getNewTimeRank(today, time, times, isStart, prevTodo);
          return await createTime(today, time, rank);
        } else {
          // 3-1-1-2. 이전 start 값이 비어있음 - 수정
          return await patchTime(prevTodo.scheduleEnd.id, time);
        }
      }

      // 3-1-3. 이전 start, end 값 없음
      const rank = await getNewTimeRank(today, time, times, isStart, prevTodo);
      return await createTime(today, time, rank);
    } else {
      // 3-2. 생성
      const rank = await getNewTimeRank(today, time, times, isStart);
      return await createTime(today, time, rank);
    }
  }
};

const getBlankTimeDate = async (
  time: Date | null,
  today: Date,
  times: TimeType[],
  isStart?: boolean,
  linkedTime?: TimeType,
  prevTodo?: TodoType
) => {
  if (prevTodo) {
    if (isStart && prevTodo.scheduleStart && !isValidDate(prevTodo.scheduleStart.time)) {
      return prevTodo.scheduleStart.time;
    }

    if (!isStart && prevTodo.scheduleEnd && !isValidDate(prevTodo.scheduleEnd.time)) {
      return prevTodo.scheduleEnd.time;
    }
  }

  if (linkedTime) {
    // 2. 값이 없는 time을 이전/이후 시간에 연결하여 생성할 경우
    let rank;
    const i = times.findIndex(
      (time) => time.rank.toString() === linkedTime.rank.toString()
    );

    if (!times || i === undefined || i === -1) {
      throw new Error(
        `${isStart ? 'End' : 'Start'} time not exists: ${getTime(linkedTime.time)} (${
          linkedTime.rank
        })`
      );
    }

    if (isStart) {
      if (i === 0) {
        // 2-1. 시작 시간일 경우 연결 시간이 맨 앞일 때 이전에 추가
        rank = times[i].rank.genPrev();
      } else {
        if (!times[i - 1].startTodo && !isValidDate(times[i - 1].time)) {
          // 2-1-1. 시작 시간일 경우 연결 시간 앞쪽이 비어있을 때(time값 / startTodo 값) 해당 시간으로 반환
          return times[i - 1];
        } else if (
          prevTodo && prevTodo.scheduleStart
            ? getTime(times[i - 2].time)
            : getTime(times[i - 1].time) === getTime(time)
        ) {
          // 2-2-2. 연결 시간 뒤쪽이 추가하는 값과 동일한 값을 가질 경우
          if (prevTodo?.scheduleStart) {
            await deleteTime(prevTodo.scheduleStart.id);
          }
          return prevTodo ? times[i - 2] : times[i - 1];
        } else {
          // 2-1-3. 시작 시간일 경우 이전 시간 앞 순서에 추가
          rank = times[i].rank.between(times[i - 1].rank);
        }
      }
    } else {
      if (i === times.length - 1) {
        // 2-2. 끝 시간일 경우 연결 시간이 맨 마지막일 때 이후에 추가
        rank = times[i].rank.genNext();
      } else {
        if (!times[i + 1].endTodo && !isValidDate(times[i + 1].time)) {
          // 2-2-1. 연결 시간 뒤쪽이 비어있을 때(time값 / endTodo 값) 해당 시간으로 반환
          return times[i + 1];
        } else if (
          prevTodo && prevTodo.scheduleEnd
            ? getTime(times[i + 2].time) === getTime(time)
            : getTime(times[i + 1].time) === getTime(time)
        ) {
          // 2-2-2. 연결 시간 뒤쪽이 추가하는 값과 동일한 값을 가질 경우
          if (prevTodo?.scheduleEnd) {
            await deleteTime(prevTodo.scheduleEnd.id);
          }
          return prevTodo ? times[i + 2] : times[i + 1];
        } else {
          // 2-2-3. 이전 시간 뒷 순서에 추가
          rank = times[i].rank.between(times[i + 1].rank);
        }
      }
    }

    return await createTime(today, time, rank);
  } else {
    // 3. 값이 없는 time을 연결 없이 새로 만들 경우 -> 가장 마지막에 추가
    let rank;
    if (!times || times.length === 0) {
      rank = LexoRank.middle();
    } else {
      rank = times[times.length - 1].rank.genNext();
    }

    return await createTime(today, time, rank);
  }
};

const getNewTimeRank = async (
  today: Date,
  time: Date,
  times: TimeType[],
  isStart?: boolean,
  prevTodo?: TodoType
) => {
  if (times.length === 0) {
    // 빈 배열에 새로 추가
    return LexoRank.middle();
  }

  let idx = -1;

  times.forEach((item, i) => {
    if (!item.time || !isValidDate(item.time)) {
      return;
    }

    if (item.time < time) {
      idx = i;
    }
  });


  if (prevTodo) {
    if (times[idx]?.startTodo && times[idx]?.startTodo?.id !== prevTodo.id) {
      if (
        isStart &&
        prevTodo.scheduleStart &&
        getTime(prevTodo.scheduleStart.time) === getTime(time)
      ) {
        throw new Error('Time conflict: Already got todo on injecting position');
      }

      if (
        !isStart &&
        prevTodo.scheduleEnd &&
        getTime(prevTodo.scheduleEnd.time) === getTime(time)
      ) {
        throw new Error('Time conflict: Already got todo on injecting position');
      }
    }
  }

  if (times[idx]?.startTodo) {
    if (times[idx + 1] && !isValidDate(times[idx + 1].time)) {
      // TODO: 주석 쓰기
      idx += 1;
      while (idx < times.length - 1) {
        if (isValidDate(times[idx].time)) {
          if (times[idx].time! > time) {
            break;
          }
        } else {
          if (isValidDate(times[idx + 1].time) && times[idx + 1].time! > time) {
            if (!isStart) {
              idx -= 1;
            }
            break;
          }
        }

        idx += 1;
      }
    } else {
      throw new Error('Time conflict: Already got todo on injecting position');
    }
  }

  if (isStart && times[idx]?.startTodo && isValidDate(times[idx].time)) {
    const prevScheduleEnd = times[idx].startTodo?.scheduleEnd?.time;
    if (
      isStart &&
      prevScheduleEnd &&
      isValidDate(prevScheduleEnd) &&
      time <= prevScheduleEnd
    ) {
      throw new Error('Time conflict: Time is smaller than prev end');
    }
  }

  if (!isStart && times[idx]?.endTodo && isValidDate(times[idx].time)) {
    const nextScheduleStart = times[idx].endTodo?.scheduleStart?.time;
    if (
      isStart &&
      nextScheduleStart &&
      isValidDate(nextScheduleStart) &&
      time <= nextScheduleStart
    ) {
      throw new Error('Time conflict: Time is bigger than next start');
    }
  }

  if (!isValidDate(time) && !isValidDate(times[idx].time) && times[idx].startTodo) {
    // Blank 추가 시.... 타겟이 blank인데 startTodo를 가질 경우, 새로운 blank를 만들어 해당 startTodo에 연결
    const rank = times[idx].rank.between(times[idx + 1].rank);

    const nextBlankRank = rank.between(times[idx + 1].rank);
    const nextBlank = await createTime(today, null, nextBlankRank);

    const nextTodoId = times[idx].startTodo?.id;
    await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/todo/' + nextTodoId, {
      method: 'PATCH',
      body: JSON.stringify({
        scheduleStartId: nextBlank.id,
      }),
    });

    return rank;
  }

  if (idx === -1 || (idx === 0 && isStart)) {
    // 맨 앞에 새로 추가
    return times[0].rank.genPrev();
  } else if (idx >= times.length - 1) {
    // 마지막에 새로 추가
    return times[times.length - 1].rank.genNext();
  } else {
    // 뒤쪽에 새로 추가
    return times[idx]?.rank.between(times[idx + 1].rank);
  }
};

const createTime = async (today: Date, time: Date | null, rank: LexoRank) => {
  try {
    const timeResponse = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/time', {
      method: 'POST',
      body: JSON.stringify({
        date: getDashDate(today),
        time: time && isValidDate(time) ? time.toISOString() : null,
        rank: rank.toString(),
      }),
    });

    if (!timeResponse.ok) {
      throw new Error(timeResponse.status + ' ' + timeResponse.statusText);
    }

    const timeJson = await timeResponse.json();
    return typeof timeJson === 'string' ? JSON.parse(timeJson) : timeJson;
  } catch (error) {
    throw error;
  }
};

const patchTime = async (id: string, time: Date | null) => {
  try {
    const timeResponse = await fetch(
      process.env.NEXT_PUBLIC_BASE_URL + '/api/time/' + id,
      {
        method: 'PATCH',
        body: JSON.stringify({
          time: time && isValidDate(time) ? time.toISOString() : null,
        }),
      }
    );

    if (!timeResponse.ok) {
      throw new Error(timeResponse.status + ' ' + timeResponse.statusText);
    }

    const timeJson = await timeResponse.json();
    return typeof timeJson === 'string' ? JSON.parse(timeJson) : timeJson;
  } catch (error) {
    throw error;
  }
};

const deleteTime = async (id: string) => {
  try {
    const timeResponse = await fetch(
      process.env.NEXT_PUBLIC_BASE_URL + '/api/time/' + id,
      {
        method: 'DELETE',
      }
    );

    if (!timeResponse.ok) {
      throw new Error(timeResponse.status + ' ' + timeResponse.statusText);
    }

    return id;
  } catch (error) {
    throw error;
  }
};

export default TodoInputOverlay;
