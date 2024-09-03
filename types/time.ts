import { LexoRank } from 'lexorank';
import { TrackType } from './track';

export interface TimeType {
  id: string;
  date: string;
  time?: Date;
  startTrack?: Partial<TrackType>;
  endTrack?: Partial<TrackType>;
  rank: LexoRank;
}
