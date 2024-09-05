import { LexoRank } from 'lexorank';

export const getLexo = (list: any[], from: number, to: number) => {
  let newLexo: LexoRank;

  if (to >= list.length - 1) {
    const lastItem = list[list.length - 1];
    newLexo = lastItem && lastItem.rank.genNext();
  } else if (to <= 0) {
    const firstItem = list[0];
    newLexo = firstItem && firstItem.rank && firstItem.rank.genPrev();
  } else if (from < to) {
    newLexo = list[to]?.rank.between(list[to + 1].rank);
  } else {
    newLexo = list[to - 1]?.rank.between(list[to].rank);
  }

  return newLexo;
};

export const getLastLexo = (list: any[]) => {
  let rank;
  if (list?.length) {
    const sorted = [...list];
    sorted.sort((a, b) => (a.rank < b.rank ? -1 : 1));
    const lastItem = sorted[list?.length - 1];
    rank = lastItem && lastItem.rank.genNext();
  } else {
    rank = LexoRank.middle();
  }
  return rank;
};
