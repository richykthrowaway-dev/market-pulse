export type Sentiment = 'bull' | 'bear' | 'neutral';

const BULL = ['surge', 'rally', 'beat', 'jumps', 'soars', 'record high', 'upgrade', 'gains', 'rises', 'tops', 'strong', 'outperform', 'bullish'];
const BEAR = ['plunge', 'slump', 'miss', 'falls', 'drops', 'sinks', 'downgrade', 'cuts', 'warns', 'weak', 'recession', 'bearish', 'selloff', 'tumble'];

/** Deterministic keyword-lexicon sentiment. Pure, total, no external cost. */
export function headlineSentiment(text: string): Sentiment {
  const t = String(text ?? '').toLowerCase();
  let s = 0;
  for (const w of BULL) if (t.includes(w)) s++;
  for (const w of BEAR) if (t.includes(w)) s--;
  return s > 0 ? 'bull' : s < 0 ? 'bear' : 'neutral';
}

/** Aggregate sentiment tally over a list of news items. Pure, never throws. */
export function newsMood(
  items: { title?: string; summary?: string }[],
): { bull: number; bear: number; neutral: number; net: number } {
  const arr = Array.isArray(items) ? items : [];
  let bull = 0, bear = 0, neutral = 0;
  for (const it of arr) {
    const s = headlineSentiment(`${it?.title ?? ''} ${it?.summary ?? ''}`);
    if (s === 'bull') bull++;
    else if (s === 'bear') bear++;
    else neutral++;
  }
  return { bull, bear, neutral, net: bull - bear };
}
