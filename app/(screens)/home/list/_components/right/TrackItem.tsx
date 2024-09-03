'use client';

import CheckButton from '@/components/button/CheckButton';
import OptionButton from '@/components/button/OptionButton';
import PlayButton from '@/components/button/PlayButton';
import IconHolder from '@/components/holder/IconHolder';
import { timesAtom } from '@/store/time';
import { tracksAtom } from '@/store/track';
import { TrackType } from '@/types/track';
import { getTime, getTimestamp } from '@/util/date';
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';

const TrackItem = ({
  id,
  thumbnail,
  profile,
  title,
  icon,
  scheduleStart,
  scheduleEnd,
  history,
  isDone,
}: TrackType) => {
  const router = useRouter();

  const [{ refetch: refetchTracks }] = useAtom(tracksAtom);
  const [{ refetch: refetchTimes }] = useAtom(timesAtom);

  const historyTotal = history?.reduce(
    (acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()),
    0
  );

  const checkHandler = async (isDone: boolean) => {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/track/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isDone }),
    });
    refetchTracks();
    refetchTimes();
  };

  return (
    <li key={id} className="w-full flex space-x-2 justify-between items-center">
      <div className="flex w-full justify-between items-center">
        <div className="flex items-center gap-2">
          {!isDone && <PlayButton />}
          {icon && !thumbnail && (
            <IconHolder className="w-10 h-10 shrink-0">
              {icon || profile?.icon}
            </IconHolder>
          )}
          <div>
            <p className="text-xs font-semibold break-words">{profile?.title}</p>
            <p className="text-sm lg:text-base">{title}</p>
          </div>
        </div>
        <div className="text-center shrink-0">
          <p className="text-[0.75rem] lg:text-base font-semibold">
            {getTimestamp(historyTotal || 0)}
          </p>
          <p className="text-[0.625rem] text-gray-400">
            {scheduleStart &&
              scheduleEnd &&
              `/${getTime(scheduleStart.time)}~${getTime(scheduleEnd.time)}`}
          </p>
        </div>
      </div>
      <CheckButton checked={!!isDone} onChecked={checkHandler} />
      <OptionButton
        menu={[
          {
            name: 'Edit Track',
            action: () => {
              router.push(`/home/list?track-input=show&trackId=${id}`);
            },
          },
          {
            name: 'Delete Track',
            action: async () => {
              await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/track/${id}`, {
                method: 'DELETE',
              });

              if (scheduleStart && !scheduleStart.endTrack) {
                await fetch(
                  process.env.NEXT_PUBLIC_BASE_URL + '/api/time/' + scheduleStart.id,
                  {
                    method: 'DELETE',
                  }
                );
              }

              if (scheduleEnd && !scheduleEnd.startTrack) {
                await fetch(
                  process.env.NEXT_PUBLIC_BASE_URL + '/api/time/' + scheduleEnd.id,
                  {
                    method: 'DELETE',
                  }
                );
              }

              await refetchTracks();
              await refetchTimes();
            },
          },
        ]}
      />
    </li>
  );
};

export default TrackItem;
