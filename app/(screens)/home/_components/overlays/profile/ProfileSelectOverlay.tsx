'use client';

import Button from '@/components/button/Button';
import IconHolder from '@/components/holder/IconHolder';
import Overlay from '@/components/overlay/Overlay';
import { ProfileType } from '@/types/profile';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaPencil, FaPlus } from 'react-icons/fa6';
import CategoryTab from '../../ui/CategoryTab';
import ProfileListWrapper from '../../ui/ProfileListWrapper';

const ProfileSelectOverlay = () => {
  return (
    <Overlay
      id="profile-select"
      title="Select profile"
      isRight={true}
      className="flex flex-col items-center"
    >
      <CategoryTab id="profile-select-overlay-category" className="mt-4 text-xs" />
      <ProfileListWrapper className="flex flex-col items-center my-6 space-y-5 max-h-[60vh] overflow-scroll">
        <ProfileSelectItem />
      </ProfileListWrapper>
      <div className="flex justify-center gap-16">
        <Link
          href="/home/list?profile-edit=show"
          className="w-full p-4 flex gap-1 justify-center items-center text-xs text-center font-extrabold"
        >
          <FaPlus />
          Add profile
        </Link>
        <Link
          href="/home/list?profile-list-edit=show"
          className="w-full p-4 flex gap-1 justify-center items-center text-xs text-center font-extrabold"
        >
          <FaPencil />
          Edit profile
        </Link>
      </div>
    </Overlay>
  );
};

const ProfileSelectItem = ({ id, title, icon, category }: Partial<ProfileType>) => {
  const router = useRouter();

  const selectProfileHandler = () => {
    router.replace(`/home/list?track-input=show&profileId=${id}`);
  };

  return (
    <li
      key={title}
      className="w-full flex items-center justify-between px-4 cursor-pointer"
    >
      <div className="flex gap-2 items-center">
        <IconHolder isCircle={true}>{icon}</IconHolder>
        <div className="text-left">
          <p className="text-xs font-semibold">{category?.title}</p>
          <p className="text-lg font-bold leading-tight">{title}</p>
        </div>
      </div>
      <Button className="px-2 py-1 text-xs rounded-md" onClick={selectProfileHandler}>Add Track</Button>
    </li>
  );
};

export default ProfileSelectOverlay;
