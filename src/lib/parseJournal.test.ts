import { describe, it, expect } from 'vitest';
import { parseJournal } from './parseJournal';

describe('parseJournal', () => {
  it('null / non-array / bad JSON -> empty', () => {
    expect(parseJournal(null)).toEqual({ trades: [], dropped: 0 });
    expect(parseJournal('nope')).toEqual({ trades: [], dropped: 0 });
    expect(parseJournal('{"a":1}')).toEqual({ trades: [], dropped: 0 });
  });
  it('repairs missing exitDate from entryDate/createdAt (no throw on sort)', () => {
    const raw = JSON.stringify([
      { id: '1', symbol: 'AAPL', entryDate: '2026-05-10', createdAt: '2026-05-12T00:00:00Z' },
    ]);
    const r = parseJournal(raw);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0].exitDate).toBe('2026-05-10');
    expect(() => [...r.trades].sort((a, b) => b.exitDate.localeCompare(a.exitDate))).not.toThrow();
  });
  it('drops rows missing id+symbol; counts them', () => {
    const raw = JSON.stringify([
      { id: '1', symbol: 'AAPL', exitDate: '2026-05-12' },
      { foo: 'bar' },
      42,
    ]);
    const r = parseJournal(raw);
    expect(r.trades).toHaveLength(1);
    expect(r.dropped).toBe(2);
  });
});
