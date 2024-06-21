import { CategoryType } from '@/types/category';
import { atomWithQuery } from 'jotai-tanstack-query';
import { LexoRank } from 'lexorank';

export const categoriesAtom = atomWithQuery<CategoryType[]>(() => {
  return {
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/category');
      const categories = await res.json();

      return categories.map((category: any) => ({
        ...category,
        rank: LexoRank.parse(category.rank),
      }));
    },
  };
});
