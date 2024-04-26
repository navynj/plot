import { CategoryType } from "./category";

export interface SubjectType {
  title: string;
  icon: string;
  categoryId: string;
  userId: string;
  category: CategoryType;
}
