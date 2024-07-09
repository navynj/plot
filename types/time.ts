import { LexoRank } from 'lexorank';
import { TodoType } from './todo';

export interface TimeType {
  id: string;
  date: string;
  time?: Date;
  startTodo?: Partial<TodoType>;
  endTodo?: Partial<TodoType>;
  rank: LexoRank;
}
