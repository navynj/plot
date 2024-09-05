'use client';

import Button from '@/components/button/Button';
import IconHolder from '@/components/holder/IconHolder';
import { ProfileType } from '@/types/profile';
import Link from 'next/link';
import ProfileListWrapper from '../../../_components/ui/ProfileListWrapper';

const ProfileColumns = () => {
  return (
    <ProfileListWrapper className="flex justify-start overflow-x-scroll scrollbar-hide border-primary border-b-4">
      <ProfileSelectItem />
    </ProfileListWrapper>
  );
};

const ProfileSelectItem = ({ id, title, icon, category }: Partial<ProfileType>) => {
  return (
    <li
      key={title}
      className="flex flex-col items-center justify-between w-28 lg:w-32 shrink-0 space-y-4 px-2 py-4 border-gray-200 border-r"
    >
      <div className="flex flex-col space-y-2 items-center">
        <IconHolder isCircle={true}>{icon}</IconHolder>
        <div className="text-center">
          <p className="text-sm font-semibold">{category?.title}</p>
          <p className="text-lg font-extrabold leading-tight">{title}</p>
        </div>
      </div>
      <Link href={`/home/list?track-input=show&profileId=${id}`}>
        <Button className="px-2 py-1 text-xs rounded-md">Add Track</Button>
      </Link>
    </li>
  );
};

export default ProfileColumns;