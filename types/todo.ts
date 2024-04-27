export interface TodoType {
  id: string;
  title: string;
  content?: string;
  icon?: string;
  thumbnail?: string;
  subjectTitle?: string;
  subjectIcon?: string;
  tags?: TagType[];
  repeatingDays?: number[];
  scheduleStart?: Date;
  scheduleEnd?: Date;
  history?: HistoryType[];
  isDone?: boolean;
  date?: Date;
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
