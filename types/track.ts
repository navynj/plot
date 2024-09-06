import { LexoRank } from 'lexorank';
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

export const convertTrackData = (tracks: any[]) => {
  return tracks.map((track: any) => ({
    ...track,
    scheduleStart: track.scheduleStart && {
      ...track.scheduleStart,
      time: track.scheduleStart && new Date(track.scheduleStart.time),
      rank: LexoRank.parse(track.scheduleStart.rank),
    },
    scheduleEnd: track.scheduleEnd && {
      ...track.scheduleEnd,
      time: track.scheduleEnd && new Date(track.scheduleEnd.time),
      rank: LexoRank.parse(track.scheduleEnd.rank),
    },
  }));
}
