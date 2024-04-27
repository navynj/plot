'use client';

import Loader from '@/components/loader/Loader';
import Tab from '@/components/tab/Tab';
import { categoriesAtom } from '@/store/category';
import { useAtom } from 'jotai';

const CategoryTab = () => {
  const [{ data, isPending, isError }] = useAtom(categoriesAtom);

  return (
    <div className="flex gap-4 text-xs">
      <button className="font-extrabold">=</button>
      <Tab
        id="category-tab"
        tabs={[
          { label: 'All', value: 'all', checked: true },
          isPending ? <Loader key="loader" className="w-4 h-4" /> : undefined,
          ...(data?.map((category, i) => ({
            label: category.title,
            value: category.id,
          })) || []),
          { label: 'etc.', value: 'etc' },
        ]}
      />
    </div>
  );
};

export default CategoryTab;
