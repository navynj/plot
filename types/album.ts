import { LexoRank } from 'lexorank';
import { ProfileType } from './profile';

export interface AlbumType {
  id: string;
  title: string;
  icon: string;
  profileId: string;
  profile: ProfileType;
  rank: LexoRank;
  userId: string;
}
