/** MGRS 100 km square letters from a UTM easting/northing in a given zone. */
const COL_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUV';

export function squareLettersFromUtm(zone, easting, northing) {
  const z = Number(zone);
  const e = Number(easting);
  const n = Number(northing);
  if (!Number.isFinite(z) || !Number.isFinite(e) || !Number.isFinite(n)) return '';
  const col = Math.floor(e / 100000);
  if (col < 1 || col > 8) return '';
  const colLetter = COL_LETTERS[((Math.trunc(z) - 1) % 3) * 8 + col - 1];
  let row = Math.floor(n / 100000) % 20;
  if (Math.trunc(z) % 2 === 0) row = (row + 5) % 20;
  if (row < 0) row += 20;
  return `${colLetter}${ROW_LETTERS[row]}`;
}
