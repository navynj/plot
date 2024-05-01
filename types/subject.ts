import { CategoryType } from './category';

export interface SubjectType {
  id: string;
  title: string;
  icon: string;
  categoryId: string;
  userId: string;
  category: CategoryType;
}
