'use client';

import Loader from '@/components/loader/Loader';
import { tracksAtom } from '@/store/track';
import { useAtom } from 'jotai';
import { useMemo } from 'react';
import TrackItem from './TrackItem';

const TrackList = () => {
  const [{ data, isPending, isFetching, isError }] = useAtom(tracksAtom);

  const tracks = useMemo(() => {
    return data?.filter((track) => track.isDone);
  }, [data]);

  return (
    tracks &&
    tracks.length > 0 && (
      <div>
        <h3 className="block border-b border-b-black p-2 font-semibold">DONE</h3>
        <ol className="flex flex-col items-center px-4 py-6 space-y-3">
          {tracks.map((track) => (
            <TrackItem key={track.id} {...track} />
          ))}
          {isPending ||
            (isFetching && (
              <div className="p-16">
                <Loader />
              </div>
            ))}
        </ol>
      </div>
    )
  );
};

export default TrackList;
