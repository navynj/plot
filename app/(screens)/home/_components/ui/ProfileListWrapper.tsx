'use client';

import Loader from '@/components/loader/Loader';
import { profilesAtom } from '@/store/profile';
import { categoryAtom } from '@/store/ui';
import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import { useAtom, useAtomValue } from 'jotai';
import React, { PropsWithChildren } from 'react';

const ProfileListWrapper = ({
  className,
  children,
}: PropsWithChildren<ClassNameProps>) => {
  const category = useAtomValue(categoryAtom);
  const [{ data, isPending, isFetching, isError }] = useAtom(profilesAtom);

  return (
    <ul
      className={cn(
        'w-full',
        className,
        isPending || isFetching ? 'p-8 justify-center items-center' : ''
      )}
    >
      {(isPending || isFetching) && <Loader />}
      {!(isPending || isFetching) &&
        React.Children.map(children, (child, i) => {
          if (i === 0 && React.isValidElement(child)) {
            // NOTE: 첫번째 자식 컴포넌트를 템플릿으로 사용
            // NOTE: 카테고리별로 필터링된 profile의 props를 템플릿에 전달
            return data
              ?.filter(
                (profile) =>
                  category === 'all' ||
                  profile.categoryId === category ||
                  (category === 'etc' && !profile.categoryId)
              )
              .map((profile) => React.cloneElement(child, profile));
          } else if (!isPending) {
            return child;
          }
        })}
    </ul>
  );
};

export default ProfileListWrapper;
