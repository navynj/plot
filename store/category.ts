import { CategoryType } from '@/types/category';
import { atomWithQuery } from 'jotai-tanstack-query';

export const categoriesAtom = atomWithQuery<CategoryType[]>(() => {
  return {
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/category');
      return res.json();
    },
  };
});
