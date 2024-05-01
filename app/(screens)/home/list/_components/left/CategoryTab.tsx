'use client';

import Loader from '@/components/loader/Loader';
import Tab from '@/components/tab/Tab';
import { categoriesAtom } from '@/store/category';
import { categoryAtom } from '@/store/ui';
import { useAtom, useSetAtom } from 'jotai';

const CategoryTab = () => {
  const setCategory = useSetAtom(categoryAtom);
  const [{ data, isPending, isError }] = useAtom(categoriesAtom);

  return (
    <div className="flex gap-4 text-xs">
      <button className="font-extrabold">=</button>
      <Tab
        id="category-tab"
        tabs={[
          {
            label: 'All',
            value: 'all',
            checked: true,
            onClick: () => {
              setCategory('all');
            },
          },
          isPending ? <Loader key="loader" className="w-4 h-4" /> : undefined,
          ...(data?.map((category, i) => ({
            label: category.title,
            value: category.id,
            onClick: () => {
              setCategory(category.id);
            },
          })) || []),
          {
            label: 'etc.',
            value: 'etc',
            onClick: () => {
              setCategory('etc');
            },
          },
        ]}
      />
    </div>
  );
};

export default CategoryTab;
