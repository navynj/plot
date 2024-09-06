'use client';

import CheckButton from '@/components/button/CheckButton';
import PlayButton from '@/components/button/PlayButton';
import IconHolder from '@/components/holder/IconHolder';
import Loader from '@/components/loader/Loader';
import { timesAtom } from '@/store/time';
import { tracksAtom } from '@/store/track';
import { TimeType } from '@/types/time';
import { cn } from '@/util/cn';
import { getTime, getTimestamp } from '@/util/date';
import { useAtom } from 'jotai';
import Link from 'next/link';
import { FaPlus } from 'react-icons/fa';
import DayNav from '../date/DayNav';

const TimelineColumn = () => {
  const [
    {
      data: times,
      isFetching: isFetchingTimes,
      isError: timesError,
      refetch: refetchTimes,
    },
  ] = useAtom(timesAtom);
  const [{ isFetching: isFetchingTracks, isError: tracksError, refetch: refetchTracks }] =
    useAtom(tracksAtom);

  return (
    <div className="flex gap-1 border-primary border-b-4 ">
      <DayNav className="mt-[-0.5rem] px-4 pb-4" isVertical={true} />
      <ul
        className={cn(
          'w-full flex justify-start overflow-x-scroll [&>*]:scroll-ml-5 scrollbar-hide px-4'
        )}
      >
        {isFetchingTracks && (
          <Loader className="w-full flex justify-center items-center py-4 box-content" />
        )}
        {times?.map((time, i) => {
          const isLast = i === times.length - 1;

          if (isLast) {
            return (
              <li
                key={time.id}
                id={`schedule-column-${getTime(time.time)}`}
                className="relative border-gray-200 border-l"
              >
                <span className="absolute top-0 left-[-1rem] text-xs text-gray-400 bg-white whitespace-nowrap">
                  {getTime(time.time)}
                </span>
              </li>
            );
          } else {
            return (
              <li
                key={time.id}
                id={`schedule-column-${getTime(time.time)}`}
                className={`relative flex flex-col items-center justify-between ${
                  time.startTrack ? 'w-28 lg:w-32' : ''
                } shrink-0 space-y-4 px-2 py-4 border-gray-200 border-l last:border-r`}
              >
                <span className="absolute top-0 left-[-1rem] text-xs text-gray-400 bg-white whitespace-nowrap">
                  {getTime(time.time)}
                </span>
                {time.startTrack ? (
                  <ColumnItem time={time} refetchTracks={refetchTracks} />
                ) : (
                  <div className="h-full flex items-center p-1 rounded-xl">
                    <Link href={``}>
                      <div className="text-gray-300 bg-gray-100 rounded-full flex justify-center items-center text-xs p-1 box-content">
                        <FaPlus />
                      </div>
                    </Link>
                  </div>
                )}
              </li>
            );
          }
        })}
      </ul>
    </div>
  );
};

const ColumnItem = ({ time, refetchTracks }: { time: TimeType; refetchTracks: any }) => {
  const { startTrack } = time;
  const historyTotal =
    startTrack?.history?.reduce(
      (acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()),
      0
    ) || 0;

  const checkHandler = async (isDone: boolean) => {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/track/${startTrack?.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isDone }),
    });
    refetchTracks();
  };

  return (
    startTrack && (
      <>
        <div className="flex flex-col space-y-2 items-center">
          <IconHolder>{startTrack.icon || startTrack.profile?.icon}</IconHolder>
          <div className="text-center">
            <p className="text-xs font-semibold">{startTrack.profile?.title || '-'}</p>
            <p className="text-sm leading-tight">{startTrack.title}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            {!startTrack.isDone && <PlayButton />}
            <p className="text-sm lg:text-base font-extrabold">
              {getTimestamp(historyTotal || 0)}
            </p>
          </div>
          <CheckButton checked={!!startTrack.isDone} onChecked={checkHandler} />
        </div>
      </>
    )
  );
};

export default TimelineColumn;
