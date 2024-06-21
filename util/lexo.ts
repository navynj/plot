import { LexoRank } from 'lexorank';

export const getLexo = (data: any[], from: number, to: number) => {
  let newLexo: LexoRank;

  if (to >= data.length - 1) {
    const lastItem = data[data.length - 1];
    newLexo = lastItem && lastItem.rank.genNext();
  } else if (to <= 0) {
    const firstItem = data[0];
    newLexo = firstItem && firstItem.rank && firstItem.rank.genPrev();
  } else if (from < to) {
    newLexo = data[to]?.rank.between(data[to + 1].rank);
  } else {
    newLexo = data[to - 1]?.rank.between(data[to].rank);
  }

  return newLexo;
};
