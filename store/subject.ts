import { SubjectType } from '@/types/subject';
import { atomWithQuery } from 'jotai-tanstack-query';

export const subjectsAtom = atomWithQuery<SubjectType[]>(() => {
  return {
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/subject');
      return res.json();
    },
  };
});
