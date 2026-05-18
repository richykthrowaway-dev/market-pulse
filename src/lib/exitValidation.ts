/** A close may only be filed to the Journal when the exit price parses to a
 *  positive number. A true scratch (exit == entry) is still valid; only
 *  blank/0/negative/non-numeric is blocked. */
export function isValidExit(raw: string): boolean {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}
