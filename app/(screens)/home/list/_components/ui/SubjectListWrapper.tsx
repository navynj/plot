'use client';

import Loader from '@/components/loader/Loader';
import { subjectsAtom } from '@/store/subject';
import { categoryAtom } from '@/store/ui';
import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import { useAtom, useAtomValue } from 'jotai';
import React, { PropsWithChildren } from 'react';

const SubjectListWrapper = ({
  className,
  children,
}: PropsWithChildren<ClassNameProps>) => {
  const category = useAtomValue(categoryAtom);
  const [{ data, isPending, isError }] = useAtom(subjectsAtom);

  return (
    <ul
      className={cn(
        'w-full',
        className,
        isPending ? 'p-8 justify-center items-center' : ''
      )}
    >
      {isPending && <Loader />}
      {React.Children.map(children, (child, i) => {
        if (i === 0 && React.isValidElement(child)) {
          // NOTE: 첫번째 자식 컴포넌트를 템플릿으로 사용
          // NOTE: 카테고리별로 필터링된 subject의 props를 템플릿에 전달
          return data
            ?.filter(
              (subject) =>
                category === 'all' ||
                subject.categoryId === category ||
                (category === 'etc' && !subject.categoryId)
            )
            .map((subject) => React.cloneElement(child, subject));
        } else if (!isPending) {
          return child;
        }
      })}
    </ul>
  );
};

export default SubjectListWrapper;
