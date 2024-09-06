'use client';

import Loader from '@/components/loader/Loader';
import { tracksAtom } from '@/store/track';
import { useAtom } from 'jotai';
import { useMemo } from 'react';
import TrackItem from './TrackItem';

const TrackList = () => {
  const [{ data, isPending, isFetching, isError }] = useAtom(tracksAtom);

  const tracks = useMemo(() => {
    return data
      ?.filter((track) => !track.isDone)
      .sort((a, b) => {
        if (a.scheduleStart && b.scheduleStart) {
          return a.scheduleStart.rank < b.scheduleStart.rank ? -1 : 1;
        } else if (a.scheduleStart) {
          return -1;
        } else if (b.scheduleStart) {
          return 1;
        } else {
          return a.createdAt < b.createdAt ? -1 : 1;
        }
      });
  }, [data]);

  return (
    <ol className="flex flex-col items-center px-4 py-6 space-y-3">
      {!isPending &&
        !isFetching &&
        tracks?.map((track) => <TrackItem key={track.id} {...track} />)}
      {(isPending || isFetching) && (
          <div className="p-16">
            <Loader />
          </div>
        )}
    </ol>
  );
};

export default TrackList;
