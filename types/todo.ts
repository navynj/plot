import { SubjectType } from './subject';
import { TimeType } from './time';

export interface TodoType {
  id: string;
  title?: string;
  content?: string;
  icon?: string;
  thumbnail?: string;
  subject?: SubjectType;
  tags?: TagType[];
  repeatingDays?: number[];
  scheduleStart?: TimeType;
  scheduleEnd?: TimeType;
  history?: HistoryType[];
  isDone?: boolean;
  date: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface TagType {
  id: string;
  name: string;
  todoId: string;
}

export interface HistoryType {
  id: string;
  start: Date;
  end: Date;
  todoId: string;
}
