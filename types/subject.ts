import { LexoRank } from 'lexorank';
import { CategoryType } from './category';

export interface SubjectType {
  id: string;
  title: string;
  icon: string;
  categoryId: string;
  category: CategoryType;
  rank: LexoRank;
  userId: string;
}
