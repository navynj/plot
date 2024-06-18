import { LexoRank } from 'lexorank';

export interface CategoryType {
  id: string;
  title: string;
  userId: string;
  rank: LexoRank;
}
