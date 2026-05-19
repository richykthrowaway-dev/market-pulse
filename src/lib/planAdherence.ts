export type AdherenceTag = 'stopped' | 'target hit' | 'let it run' | 'cut early' | 'overstayed';

export interface ExitFacts {
  side: 'long' | 'short';
  entry: number;
  stop?: number;
  target?: number;
  exitPrice: number;
}

/** Total, never-throws classification of an exit vs the original plan. */
export function classifyExit(f: ExitFacts): AdherenceTag {
  const dir = f.side === 'long' ? 1 : -1;
  const gain = (f.exitPrice - f.entry) * dir;
  const hitStop = f.stop != null && (f.side === 'long' ? f.exitPrice <= f.stop : f.exitPrice >= f.stop);
  if (hitStop) return 'stopped';
  if (f.target != null) {
    const reached = f.side === 'long' ? f.exitPrice >= f.target : f.exitPrice <= f.target;
    const beyond = f.side === 'long' ? f.exitPrice > f.target : f.exitPrice < f.target;
    if (beyond) return 'let it run';
    if (reached) return 'target hit';
  }
  return gain < 0 ? 'cut early' : 'overstayed';
}
