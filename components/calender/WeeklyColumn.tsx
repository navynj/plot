import { todayAtom } from '@/store/track';
import { dateViewAtom } from '@/store/ui';
import { convertTrackData, TrackType } from '@/types/track';
import dayjs from 'dayjs';
import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';

const WeeklyColumn = () => {
  const [today, setToday] = useAtom(todayAtom);
  const setDateView = useSetAtom(dateViewAtom);

  const [tracks, setTracks] = useState<TrackType[]>([]);
  const [startOfWeek, setStartOfWeek] = useState(dayjs(today).startOf('week'));
  const [endOfWeek, setEndOfWeek] = useState(dayjs(today).endOf('week'));

  const weekdays = Array.from(new Array(7)).map((_, i) => {
    return dayjs(startOfWeek).add(i, 'day');
  });

  const fetchTracks = async () => {
    const start = startOfWeek.format('YYYY-MM-DD');
    const end = endOfWeek.format('YYYY-MM-DD');

    const res = await fetch(
      process.env.NEXT_PUBLIC_BASE_URL + `/api/track?startDate=${start}&endDate=${end}`
    );
    const tracks = await res.json();
    setTracks(convertTrackData(tracks));
  };

  useEffect(() => {
    fetchTracks();
  }, [startOfWeek, endOfWeek]);

  useEffect(() => {
    setStartOfWeek(dayjs(today).startOf('week'));
    setEndOfWeek(dayjs(today).endOf('week'));
  }, [today]);

  const goPrevWeekHandelr = () => {
    setStartOfWeek(dayjs(startOfWeek).add(-7, 'day'));
    setEndOfWeek(dayjs(endOfWeek).add(-7, 'day'));
  };

  const goNextWeekHandler = () => {
    setStartOfWeek(dayjs(startOfWeek).add(7, 'day'));
    setEndOfWeek(dayjs(endOfWeek).add(7, 'day'));
  };

  const goDailyViewHandler = (date: Date) => {
    setDateView('daily');
    setToday(date);
  };

  return (
    <div className="relative flex">
      <button className="text-xs text-gray-400" onClick={goPrevWeekHandelr}>
        &lt;
      </button>
      <ul className="flex w-[calc(100%-0.75rem*2)] border-primary border-b-4 [&>li:first-child]:border-none">
        {weekdays.map((day) => (
          <li
            key={day.format('D')}
            className="w-1/7 shrink-0 border-l pb-1 border-gray-200 cursor-pointer"
            onClick={goDailyViewHandler.bind(null, day.toDate())}
          >
            <div className="flex flex-col items-center">
              <span className="text-xs font-extrabold">
                {day.format('ddd').toUpperCase()}
              </span>
              <span className="text-lg font-extrabold">{day.format('D')}</span>
            </div>
            <ul className="space-y-[0.125rem] lg:space-y-1">
              {tracks
                .filter((track) => track.date === day.format('YYYY-MM-DD'))
                .map(({ id, icon, title }) => (
                  <li
                    key={id}
                    className="mx-1 p-[0.125rem] lg:p-1 whitespace-nowrap overflow-hidden bg-gray-100 rounded-[0.25rem] text-[0.6125rem] lg:text-xs"
                  >
                    {icon} {title}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      <button className="text-xs text-gray-400" onClick={goNextWeekHandler}>
        &gt;
      </button>
    </div>
  );
};

export default WeeklyColumn;
