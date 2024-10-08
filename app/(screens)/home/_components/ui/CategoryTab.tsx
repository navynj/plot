'use client';

import Loader from '@/components/loader/Loader';
import Tab from '@/components/tab/Tab';
import { categoriesAtom } from '@/store/category';
import { categoryAtom } from '@/store/ui';
import { ClassNameProps } from '@/types/className';
import { cn } from '@/util/cn';
import { useAtom } from 'jotai';
import Link from 'next/link';

interface CategoryTabProps extends ClassNameProps {
  id: string;
}

const CategoryTab = ({ id, className }: CategoryTabProps) => {
  const [category, setCategory] = useAtom(categoryAtom);
  const [{ data, isPending, isError }] = useAtom(categoriesAtom);

  return (
    <div className={cn('flex justify-center gap-4 text-xs', className)}>
      <Link href="/home/list?category-edit=show" className="font-extrabold">
        =
      </Link>
      <Tab
        id={id}
        value={category}
        setValue={setCategory}
        tabs={[
          {
            label: 'All',
            value: 'all',
          },
          isPending ? (
            <Loader key="loader" isFit={true} className="w-4 h-4" />
          ) : undefined,
          ...(data?.map((category, i) => ({
            label: category.title,
            value: category.id.toString(),
          })) || []),
          {
            label: 'etc.',
            value: 'etc',
          },
        ]}
      />
    </div>
  );
};

export default CategoryTab;
