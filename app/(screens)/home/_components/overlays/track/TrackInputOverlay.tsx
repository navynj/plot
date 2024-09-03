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
import { profilesAtom } from '@/store/profile';
import { timesAtom } from '@/store/time';
import { todayAtom, tracksAtom } from '@/store/track';
import { TimeType } from '@/types/time';
import { TrackType } from '@/types/track';
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
  profileId: z.string(),
  // content: z.string().optional(),
});

type formSchemaType = z.infer<typeof formSchema>;

const initialTime: timeStateType = {
  hour: '',
  minute: '',
  isAm: true,
};

const TrackInputOverlay = () => {
  const router = useRouter();

  const [today, setToday] = useAtom(todayAtom);
  const [emoji, setEmoji] = useAtom(emojiAtom);
  const profiles = useAtomValue(profilesAtom);
  const { refetch: refetchTimes } = useAtomValue(timesAtom);
  const { data: tracks, refetch: refetchTracks } = useAtomValue(tracksAtom);

  const [date, setDate] = useState(today);
  const [scheduleStart, setScheduleStart] = useState(initialTime);
  const [scheduleEnd, setScheduleEnd] = useState(initialTime);
  const [isProfileEmoji, setIsProfileEmoji] = useState(false);
  const [error, setError] = useState('');

  const params = useSearchParams();
  const defaultProfileId = params.get('profileId') || '';
  const trackId = params.get('trackId') || '';
  const showOverlay = params.get('track-input') || '';

  const form = useForm<formSchemaType>({
    resolver: zodResolver(formSchema),
  });

  const submitHandler = async (values: formSchemaType) => {
    setError('');

    const url = process.env.NEXT_PUBLIC_BASE_URL + '/api/track';

    try {
      const [start, end] = getIntervalFromTimeInput(scheduleStart, scheduleEnd, date);

      let startTime: TimeType | undefined = undefined;
      let endTime: TimeType | undefined = undefined;
      let startFetchedTimes, endFetchedTimes;
      const prevTrack = tracks?.find((item) => item.id === trackId);

      try {
        if (start || end) {
          if (start) {
            startFetchedTimes = await refetchTimes();
            startTime = await getTimeData(
              today,
              start,
              startFetchedTimes.data,
              prevTrack,
              true
            );
            endFetchedTimes = await refetchTimes();
            endTime = await getTimeData(
              today,
              end,
              endFetchedTimes.data,
              prevTrack,
              false,
              end ? undefined : startTime
            );
          } else {
            endFetchedTimes = await refetchTimes();
            endTime = await getTimeData(
              today,
              end,
              endFetchedTimes.data,
              prevTrack,
              false
            );
            startFetchedTimes = await refetchTimes();
            startTime = await getTimeData(
              today,
              start,
              startFetchedTimes.data,
              prevTrack,
              true,
              endTime
            );
          }
        }

        // const log = await createLog(content)

        const body = JSON.stringify({
          ...values,
          // log: log.id
          date: getDashDate(date),
          scheduleStartId: startTime && startTime.id,
          scheduleEndId: endTime && endTime.id,
        });

        if (trackId) {
          const response = await fetch(`${url}/${trackId}`, { method: 'PATCH', body });
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
        refetchTracks();
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

        if (start || end) {
          if (start && startFetchedTimes?.data) {
            for (let time of startFetchedTimes?.data) {
              await patchTime(time.id, time.time, time);
            }
          } else if (endFetchedTimes?.data) {
            for (let time of endFetchedTimes?.data) {
              await patchTime(time.id, time.time, time);
            }
          }
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

  // Track 수정 시 기본값 세팅
  useEffect(() => {
    if (showOverlay) {
      const trackData = tracks?.find((item) => item.id === trackId);
      if (trackData && trackData.date) {
        setDate(new Date(trackData.date));
        form.setValue('title', trackData.title || '');
        form.setValue('profileId', trackData.profile?.id || '');
        // form.setValue('content', trackData.content || '');
        setEmoji(trackData.icon || trackData.profile?.icon || '');
        setScheduleStart(getTimeState(trackData.scheduleStart?.time));
        setScheduleEnd(getTimeState(trackData.scheduleEnd?.time));

        if (trackData.icon === trackData.profile?.icon || !trackData.icon) {
          setIsProfileEmoji(true);
        }
      } else if (!trackData) {
        setIsProfileEmoji(true);
        form.reset();
        form.setValue('profileId', defaultProfileId);
        setTimeout(() => {
          form.setFocus('title');
        }, 50);
      }
    } else {
      setIsProfileEmoji(false);
    }
  }, [showOverlay, trackId, defaultProfileId, tracks]);

  // Profile 변경 시 이모지 업데이트 (단, 사용자가 설정하지 않았을 경우)
  const profileId = form.watch('profileId');

  useEffect(() => {
    if (isProfileEmoji) {
      const profile = profiles.data?.find((item) => item.id === profileId);
      form.setValue('icon', profile?.icon || '');
      setEmoji(profile?.icon || '');
    }
  }, [profileId, isProfileEmoji, profiles]);

  // Emoji 선택값으로 업데이트
  useEffect(() => {
    const profile = profiles.data?.find((item) => item.id === profileId);

    if (showOverlay) {
      if (emoji) {
        form.setValue('icon', emoji);
        if (emoji !== profile?.icon) {
          setIsProfileEmoji(false);
        }
      } else {
        form.setValue('icon', profile?.icon || '');
        setEmoji(profile?.icon || '');
        setIsProfileEmoji(true);
      }
    }
  }, [emoji]);

  return (
    <OverlayForm<formSchemaType>
      id="track-input"
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
        <EmojiInput params={`&track-input =show&profileId=${profileId}&trackId=${trackId}`}>
          <input {...form.register('icon')} hidden />
        </EmojiInput>
        <div className="flex flex-col justify-between gap-2 min-w-0 [&>*]:bg-gray-100 [&>*]:px-2 [&>*]:py-2.5 [&>*]:rounded-lg">
          <select {...form.register('profileId')} className="h-full">
            <option value="">주제 없음</option>
            {profiles.data?.map((item) => (
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
          // {...form.register('content')}
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
  prevTrack?: TrackType,
  isStart?: boolean,
  linkedTime?: TimeType
) => {
  if (!times) {
    throw new Error('Fail to get time list');
  }

  if (!time || !isValidDate(time)) {
    // 1. 빈 값일 경우
    return await getBlankTimeDate(time, today, times, isStart, linkedTime, prevTrack);
  }

  const timeIdx = times.findIndex((item) => {
    return getTime(item.time) === getTime(time);
  });
  if (timeIdx > -1) {
    // 2. 기존 값이 존재할 경우 - Track를 갖고 있지 않은 시간일 경우 반환, 이외 에러
    if (
      !prevTrack &&
      ((isStart && times[timeIdx].startTrack) || (!isStart && times[timeIdx].endTrack))
    ) {
      throw new Error('Time conflict: Existing time has already got tracks');
    }

    if (prevTrack) {
      // 수정으로 인해 기존 scheduleStart/scheudleEnd가 더 이상 해당 track에 연결되지 않을 경우 삭제
      if (
        isStart &&
        prevTrack.scheduleStart &&
        !prevTrack.scheduleStart.endTrack &&
        getTime(prevTrack.scheduleStart.time) !== getTime(time)
      ) {
        await deleteTime(prevTrack.scheduleStart.id);
      }

      if (
        !isStart &&
        prevTrack.scheduleEnd &&
        prevTrack.scheduleEnd.startTrack &&
        getTime(prevTrack.scheduleEnd.time) !== getTime(time)
      ) {
        await deleteTime(prevTrack.scheduleEnd.id);
      }
    }

    return times[timeIdx];
  } else {
    // 3. 새로운 값일 경우
    if (prevTrack) {
      // 3-1. 수정
      if (isStart && prevTrack.scheduleStart) {
        // 3-1-1. 이전 start 값이 존재
        if (prevTrack.scheduleStart.endTrack) {
          // 3-1-1-1. 이전 start 값에 endTrack가 존재 - 생성
          const rank = await getNewTimeRank(today, time, times, isStart, prevTrack);
          return await createTime(today, time, rank);
        } else {
          // 3-1-1-2. 이전 start 값이 비어있음 - 수정
          return await patchTime(prevTrack.scheduleStart.id, time);
        }
      }

      if (!isStart && prevTrack.scheduleEnd) {
        // 3-1-1. 이전 end 값이 존재
        if (prevTrack.scheduleEnd.startTrack) {
          // 3-1-1-1. 이전 start 값에 startTrack가 존재 - 생성
          const rank = await getNewTimeRank(today, time, times, isStart, prevTrack);
          return await createTime(today, time, rank);
        } else {
          // 3-1-1-2. 이전 start 값이 비어있음 - 수정
          return await patchTime(prevTrack.scheduleEnd.id, time);
        }
      }

      // 3-1-3. 이전 start, end 값 없음
      const rank = await getNewTimeRank(today, time, times, isStart, prevTrack);
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
  prevTrack?: TrackType
) => {
  if (prevTrack) {
    if (isStart && prevTrack.scheduleStart && !isValidDate(prevTrack.scheduleStart.time)) {
      return prevTrack.scheduleStart.time;
    }

    if (!isStart && prevTrack.scheduleEnd && !isValidDate(prevTrack.scheduleEnd.time)) {
      return prevTrack.scheduleEnd.time;
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
        // 2-1-1. 시작 시간일 경우 연결 시간이 맨 앞일 때 이전에 추가
        rank = times[i].rank.genPrev();
      } else {
        if (!times[i - 1].startTrack && !isValidDate(times[i - 1].time)) {
          // 2-1-2. 시작 시간일 경우 연결 시간 앞쪽이 비어있을 때(time값 / startTrack 값) 해당 시간으로 반환
          return times[i - 1];
        } else if (
          prevTrack && prevTrack.scheduleStart
            ? getTime(times[i - 2].time)
            : getTime(times[i - 1].time) === getTime(time)
        ) {
          // 2-1-3. 연결 시간 앞쪽이 추가하는 값과 동일한 값을 가질 경우
          if (prevTrack?.scheduleStart) {
            await deleteTime(prevTrack.scheduleStart.id);
          }
          return prevTrack ? times[i - 2] : times[i - 1];
        } else if (
          times[i - 1].startTrack &&
          !isValidDate(times[i - 1].startTrack?.scheduleStart?.time)
        ) {
          // 2-2-5. 연결시간 앞쪽이 이미 startTrack를 가지고 있고, 해당 투두의 ScheduleStart가 --:--인 경우
          const prevBlankRank = times[i].rank.between(times[i - 1].rank);
          const prevBlank = await createTime(today, null, prevBlankRank);

          const prevTrackId = times[i - 1].startTrack?.id;
          await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/track/' + prevTrackId, {
            method: 'PATCH',
            body: JSON.stringify({
              scheduleStartId: prevBlank.id,
            }),
          });

          return prevBlank;
        } else {
          // 2-1-4. 시작 시간일 경우 이전 시간 앞 순서에 추가
          rank = times[i].rank.between(times[i - 1].rank);
        }
      }
    } else {
      if (i === times.length - 1) {
        // 2-2-1. 끝 시간일 경우 연결 시간이 맨 마지막일 때 이후에 추가
        rank = times[i].rank.genNext();
      } else {
        if (!times[i + 1].endTrack && !isValidDate(times[i + 1].time)) {
          // 2-2-2. 연결 시간 뒤쪽이 비어있을 때(time값 / endTrack 값) 해당 시간으로 반환
          return times[i + 1];
        } else if (
          prevTrack && prevTrack.scheduleEnd
            ? getTime(times[i + 2].time) === getTime(time)
            : getTime(times[i + 1].time) === getTime(time)
        ) {
          // 2-2-3. 연결 시간 뒤쪽이 추가하는 값과 동일한 값을 가질 경우
          if (prevTrack?.scheduleEnd) {
            await deleteTime(prevTrack.scheduleEnd.id);
          }
          return prevTrack ? times[i + 2] : times[i + 1];
        } else if (
          times[i + 1].endTrack &&
          !isValidDate(times[i + 1].endTrack?.scheduleStart?.time)
        ) {
          // 2-2-5. 연결시간 뒤쪽이 이미 endTrack를 가지고 있고, 해당 투두의 ScheduleStart가 --:--인
          const nextBlankRank = times[i].rank.between(times[i + 1].rank);
          const nextBlank = await createTime(today, null, nextBlankRank);

          const nextTrackId = times[i + 1].endTrack?.id;
          await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/track/' + nextTrackId, {
            method: 'PATCH',
            body: JSON.stringify({
              scheduleStartId: nextBlank.id,
            }),
          });

          return nextBlank;
        } else {
          // 2-2-4. 이전 시간 뒷 순서에 추가
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
  prevTrack?: TrackType
) => {
  if (times.length === 0) {
    // 빈 배열에 새로 추가
    return LexoRank.middle();
  }

  let idx = -1;

  // time 값 기반 주입 위치 탐색 로직
  // 1) 값이 존재하는 시간만 필터링
  const valuedTimes = times.filter((item) => isValidDate(item.time));

  let startRank: LexoRank | undefined;
  let endRank: LexoRank | undefined;

  // 2) 타겟 시간이 현재시간보다 작을 경후 start로 지정, 다음 시간을 end로 지정
  valuedTimes.forEach((item, i) => {
    if (item.time! < time) {
      startRank = item.rank;
      if (i + 1 < valuedTimes.length) {
        endRank = valuedTimes[i + 1].rank;
      } else {
        endRank = startRank;
      }
    }
  });

  // 3) rank 기반으로 실제 인덱스 찾기
  let startIdx = -1;
  let endIdx = -1;

  if (startRank && endRank) {
    startIdx = times.findIndex((item) => item.rank.toString() === startRank?.toString());
    endIdx = times.findIndex((item) => item.rank.toString() === endRank?.toString());
  }

  // 4) 새로운 time이 위치할 기준 인덱스 찾기
  const diff = endIdx - startIdx;

  if (diff === 0) {
    // 4-1) startIdx와 endIdx가 같은 경우 (맨 앞에 위치해야할 시간인 경우)
    if (startIdx === -1) {
      idx = -1;
    } else {
      idx = times.length - 1;
    }
  } else if (diff === 1) {
    // 4-1) 사이에 blank time이 없는 경우
    if (times[startIdx].startTrack) {
      idx = endIdx;
    } else {
      idx = startIdx;
    }
  } else if (diff === 2) {
    // 4-2) 사이에 blank time이 하나인 경우
    if (isStart) {
      idx = startIdx + 1;
    } else {
      idx = startIdx;
    }
  } else {
    // 사이에 blank time이 여럿인 경우 -> 시간 선택창 띄우기
    throw new Error('TODO: 타임라인 편집 오버레이 구현 후 추후 개발');
  }

  if (prevTrack) {
    if (times[idx]?.startTrack && times[idx]?.startTrack?.id !== prevTrack.id) {
      if (
        isStart &&
        prevTrack.scheduleStart &&
        getTime(prevTrack.scheduleStart.time) === getTime(time)
      ) {
        // 편집 시간이 이전 시간과 동일할 경우 제외, 주입 위치에 이미 startTrack가 있는 경우 에러
        throw new Error('Time conflict: Already got track on injecting position');
      }

      if (
        !isStart &&
        prevTrack.scheduleEnd &&
        getTime(prevTrack.scheduleEnd.time) === getTime(time)
      ) {
        // 편집 시간이 이전 시간과 동일할 경우 제외, 주입 위치에 이미 endTrack가 있는 경우 에러
        throw new Error('Time conflict: Already got track on injecting position');
      }
    }
  }

  if (isStart && times[idx]?.startTrack && isValidDate(times[idx].time)) {
    const prevScheduleEnd = times[idx].startTrack?.scheduleEnd?.time;
    if (
      isStart &&
      prevScheduleEnd &&
      isValidDate(prevScheduleEnd) &&
      time <= prevScheduleEnd
    ) {
      throw new Error('Time conflict: Time is smaller than prev end');
    }
  }

  if (!isStart && times[idx]?.endTrack && isValidDate(times[idx].time)) {
    const nextScheduleStart = times[idx].endTrack?.scheduleStart?.time;
    if (
      isStart &&
      nextScheduleStart &&
      isValidDate(nextScheduleStart) &&
      time <= nextScheduleStart
    ) {
      throw new Error('Time conflict: Time is bigger than next start');
    }
  }

  // if (!isValidDate(time) && !isValidDate(times[idx].time) && times[idx].startTrack) {
  //   // Blank 추가 시 - 타겟이 blank인데 startTrack를 가질 경우, 새로운 blank를 만들어 해당 startTrack에 연결
  //   const rank = times[idx].rank.between(times[idx + 1].rank);
  //   console.log(times[idx], times[idx + 1]);

  //   const nextBlankRank = rank.between(times[idx + 1].rank);
  //   const nextBlank = await createTime(today, null, nextBlankRank);

  //   const nextTrackId = times[idx].startTrack?.id;
  //   await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/track/' + nextTrackId, {
  //     method: 'PATCH',
  //     body: JSON.stringify({
  //       scheduleStartId: nextBlank.id,
  //     }),
  //   });

  //   return rank;
  // }

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

const patchTime = async (id: string, time?: Date | null, replacingTime?: TimeType) => {
  const timeUrl = process.env.NEXT_PUBLIC_BASE_URL + '/api/time/';
  const trackUrl = process.env.NEXT_PUBLIC_BASE_URL + '/api/track/';

  try {
    const timeResponse = await fetch(timeUrl + id, {
      method: 'PATCH',
      body: JSON.stringify({
        time: time && isValidDate(time) ? time.toISOString() : null,
        rank: replacingTime?.rank.toString(),
      }),
    });

    if (replacingTime) {
      if (replacingTime?.startTrack) {
        await fetch(trackUrl + replacingTime.startTrack.id, {
          method: 'PATCH',
          body: JSON.stringify({
            scheduleStartId: replacingTime?.id,
          }),
        });
      }

      if (replacingTime?.endTrack) {
        await fetch(trackUrl + replacingTime.endTrack.id, {
          method: 'PATCH',
          body: JSON.stringify({
            scheduleEndId: replacingTime?.id,
          }),
        });
      }
    }

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

export default TrackInputOverlay;
