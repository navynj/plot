import { AlbumType } from './album';
import { ProfileType } from './profile';
import { TimeType } from './time';

export interface TrackType {
  id: string;
  title?: string;
  summary?: string;
  content?: string;
  icon?: string;
  thumbnail?: string;
  profile?: ProfileType;
  profileId?: string;
  album?: AlbumType;
  albumId?: string;
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
  trackId: string;
}

export interface HistoryType {
  id: string;
  start: Date;
  end: Date;
  trackId: string;
}
