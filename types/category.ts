import { LexoRank } from 'lexorank';

export interface CategoryType {
  id: string | number;
  title: string;
  userId?: string;
  rank: LexoRank;
}
