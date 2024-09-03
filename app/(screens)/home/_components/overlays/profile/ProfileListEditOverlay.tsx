'use client';

import { lockXAxis } from '@/components/draggable/DraggableItem';
import DraggableList from '@/components/draggable/DraggableList';
import IconHolder from '@/components/holder/IconHolder';
import Loader from '@/components/loader/Loader';
import Overlay from '@/components/overlay/Overlay';
import SaveCancelButton from '@/components/overlay/SaveCancelButton';
import { profilesAtom } from '@/store/profile';
import { getLexo } from '@/util/lexo';
import { useAtom } from 'jotai';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Draggable,
  DraggableProvided,
  DraggableRubric,
  DraggableStateSnapshot,
} from 'react-beautiful-dnd';
import { FaPencil, FaPlus, FaTrashCan } from 'react-icons/fa6';

const ProfileListEditOverlay = () => {
  const router = useRouter();

  const [{ data, refetch: refetchProfiles, isFetching }] = useAtom(profilesAtom);

  const [profiles, setProfiles] = useState(data);
  const [isPending, setIsPending] = useState(false);

  const submitHandler = async () => {
    const url = process.env.NEXT_PUBLIC_BASE_URL + '/api/profile';

    if (!profiles) {
      console.error('Profiles not exist');
      return;
    }

    let isEqual = profiles.length === data?.length;

    if (isEqual) {
      data?.forEach((item, i) => {
        if (item.id !== profiles[i]?.id) {
          isEqual = false;
          return;
        }
      });
    }

    if (isEqual) {
      router.back();
      return;
    }

    setIsPending(true);

    for (const profile of profiles) {
      await fetch(`${url}/${profile.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ rank: profile.rank.toString() }),
      });
    }

    if (data) {
      const profileIds = profiles.map((profile) => profile.id);
      const removingProfiles = data.filter((item) => !profileIds.includes(item.id));

      for (const profile of removingProfiles) {
        await fetch(`${url}/${profile.id}`, { method: 'DELETE' });
      }
    }

    refetchProfiles();
    setIsPending(false);
    router.back();
  };

  const removeHandler = async (i: number) => {
    setProfiles((prev) => {
      const next = prev ? [...prev] : [];
      next.splice(i, 1);
      return next;
    });
  };

  const dragEndHandler = async (from: number, to: number) => {
    setProfiles((prev) => {
      const next = prev ? [...prev] : [];
      next[from].rank = getLexo(next, from, to);
      return next;
    });
  };

  useEffect(() => {
    setProfiles(data);
  }, [data]);

  const renderProfile = (
    provided: DraggableProvided,
    snapshot: DraggableStateSnapshot,
    rubric: DraggableRubric
  ) => {
    const lockedProvided = lockXAxis(provided);
    const i = rubric.source.index;
    if (profiles) {
      const { id, icon, title, category } = profiles[i];
      return (
        <li
          {...lockedProvided.draggableProps}
          ref={lockedProvided.innerRef}
          className="py-2 flex justify-between gap-2 items-center"
        >
          <div className="w-full flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <IconHolder isCircle={true}>{icon}</IconHolder>
              <div className="text-left">
                <p className="text-xs font-semibold">{category?.title}</p>
                <p className="text-lg font-bold leading-tight">{title}</p>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              <Link href={`/home/list?profile-edit=show&profileId=${id}`} className="p-2">
                <FaPencil />
              </Link>
              <div
                className="p-2"
                onClick={() => {
                  removeHandler(i);
                }}
              >
                <FaTrashCan />
              </div>
            </div>
          </div>
          <div {...lockedProvided.dragHandleProps} className="p-2">
            =
          </div>
        </li>
      );
    } else {
      return <></>;
    }
  };

  return (
    <Overlay title="Edit profile list" id="profile-list-edit" isRight={true} hideX={true}>
      <DraggableList
        id="draggable-profile-list"
        onDragEnd={dragEndHandler}
        renderClone={renderProfile}
      >
        {(isFetching || isPending) && (
          <Loader className="w-full mt-4 flex justify-center" />
        )}
        {!(isFetching || isPending) &&
          profiles
            ?.sort((a, b) => (a.rank < b.rank ? -1 : 1))
            .map(({ id }, i) => {
              return (
                <Draggable key={id} draggableId={id} index={i}>
                  {renderProfile}
                </Draggable>
              );
            })}
      </DraggableList>
      <Link
        href="/home/list?profile-edit=show"
        className="w-full p-4 flex gap-1 justify-center items-center text-xs text-center font-extrabold"
      >
        <FaPlus />
        Add profile
      </Link>
      <SaveCancelButton onSave={submitHandler} isPending={isPending} />
    </Overlay>
  );
};

export default ProfileListEditOverlay;
