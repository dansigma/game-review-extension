/** Full moves (White+Black) from ply count. */
export function fullMoveCount(plyCount: number): number {
  return Math.ceil(plyCount / 2);
}
