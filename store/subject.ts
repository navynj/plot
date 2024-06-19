import { SubjectType } from '@/types/subject';
import { atomWithQuery } from 'jotai-tanstack-query';
import { LexoRank } from 'lexorank';

export const subjectsAtom = atomWithQuery<SubjectType[]>(() => {
  return {
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/subject');
      const subjects = await res.json();

      return subjects.map((subject: any) => ({
        ...subject,
        rank: LexoRank.parse(subject.rank),
      }));
    },
  };
});
