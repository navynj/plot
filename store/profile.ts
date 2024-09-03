import { ProfileType } from '@/types/profile';
import { atomWithQuery } from 'jotai-tanstack-query';
import { LexoRank } from 'lexorank';

export const profilesAtom = atomWithQuery<ProfileType[]>(() => {
  return {
    queryKey: ['profiles'],
    queryFn: async () => {
      const res = await fetch(process.env.NEXT_PUBLIC_BASE_URL + '/api/profile');
      const profiles = await res.json();

      return profiles.map((profile: any) => ({
        ...profile,
        rank: LexoRank.parse(profile.rank),
      }));
    },
  };
});
