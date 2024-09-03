'use client';

import CheckButton from '@/components/button/CheckButton';
import OptionButton from '@/components/button/OptionButton';
import IconHolder from '@/components/holder/IconHolder';
import Loader from '@/components/loader/Loader';
import { tracksAtom } from '@/store/track';
import { getTime, getTimestamp } from '@/util/date';
import { useAtom } from 'jotai';
import { useRouter } from 'next/navigation';

const ScheduleBlocks = () => {
  const router = useRouter();

  const [{ data: tracks, isFetching, refetch, isError }] = useAtom(tracksAtom);

  return (
    <>
      <ul className="flex flex-col items-center space-y-2">
        {tracks?.map(
          (
            { id, icon, thumbnail, profile, title, history, scheduleStart, scheduleEnd },
            i
          ) => {
            const historyTotal = history?.reduce(
              (acc, curr) => acc + (curr.end.getTime() - curr.start.getTime()),
              0
            );

            let duration = 0;
            if (scheduleStart && scheduleEnd) {
              duration = 0;
                // (scheduleEnd.time.getTime() - scheduleStart!.time!.getTime()) / 10000 / 60 / 6;
            }

            const showBottom = false;
              // i === tracks.length - 1 ||
              // getTime(tracks[i + 1].scheduleStart) !== getTime(scheduleEnd);

            return (
              <>
                <li key={id} className="flex gap-2 justify-between">
                  <div className="mt-[-0.5rem] pb-2 box-border">
                    <p className="text-xs font-extrabold mb-2">
                      {getTime(scheduleStart?.time)}
                    </p>
                    <div className="w-1/2 h-[calc(100%-1.5rem)] border-r border-black" />
                  </div>
                  <div
                    style={{
                      minHeight:
                        (duration < 1 ? 60 : duration === 1 ? 80 : duration * 60) + 'px',
                    }}
                    className={`w-80 flex space-x-2 justify-between items-center bg-gray-100 p-4 rounded-xl`}
                  >
                    <div className="w-full flex justify-between items-center">
                      <div className="flex w-full justify-between items-center">
                        <div className="flex items-center gap-2">
                          {icon && !thumbnail && (
                            <IconHolder className="w-10 h-10 shrink-0 bg-white">
                              {icon || profile?.icon}
                            </IconHolder>
                          )}
                          <div>
                            <p className="text-xs font-semibold break-words">
                              {profile?.title}
                            </p>
                            <p className="text-sm lg:text-base">{title}</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-gray-300">
                        {getTimestamp(historyTotal || 0)}
                      </p>
                    </div>
                    {/* <CheckButton className="bg-white" checkedCheckClass="text-black" /> */}
                    <OptionButton
                      menu={[
                        {
                          name: 'Edit Track',
                          action: () => {
                            router.push(`/home/schedule?track-input=show&trackId=${id}`);
                          },
                        },
                        {
                          name: 'Delete Track',
                          action: async () => {
                            await fetch(
                              `${process.env.NEXT_PUBLIC_BASE_URL}/api/track/${id}`,
                              {
                                method: 'DELETE',
                              }
                            );
                            await refetch();
                          },
                        },
                      ]}
                    />
                  </div>
                </li>
                {showBottom && (
                  <li key={`${id}-bottom`} className="w-full flex gap-2 justify-between">
                    <span className="mt-[-0.5rem] text-xs font-extrabold">
                      {getTime(scheduleEnd?.time)}
                    </span>
                    {i < tracks.length - 1 && (
                      <div className="w-80 bg-gray-100 p-4 rounded-xl" />
                    )}
                  </li>
                )}
              </>
            );
          }
        )}
      </ul>
      {isFetching && (
        <div className="p-16 flex justify-center">
          <Loader />
        </div>
      )}
    </>
  );
};

export default ScheduleBlocks;
