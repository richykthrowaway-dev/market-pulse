/** A close may only be filed when the exit price parses to a positive number. */
export function isValidExit(raw: string): boolean {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}
