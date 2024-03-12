import { IChanges } from './types';

export const mergeTableChanges = (
  allChanges: IChanges,
  newChanges: IChanges,
): IChanges => {
  const mergedChanges = allChanges;
  Object.entries(newChanges).forEach(([keyR, valR]) => {
    if (!(keyR in allChanges)) {
      mergedChanges[keyR] = {};
    }
    Object.entries(valR).forEach(([keyC, valC]) => {
      mergedChanges[keyR][keyC] = valC;
    });
  });
  return mergedChanges;
};
