import { describe, it, expect } from 'vitest';
import { parseNotes, setNote } from './symbolNotes';

describe('parseNotes', () => {
  it('keeps string values, upper-cases keys', () => {
    expect(parseNotes(JSON.stringify({ aapl: 'buy dip', MSFT: 'hold' })))
      .toEqual({ AAPL: 'buy dip', MSFT: 'hold' });
  });
  it('drops non-string values; bad json / array / null → {}', () => {
    expect(parseNotes(JSON.stringify({ A: 'ok', B: 5, C: { x: 1 } }))).toEqual({ A: 'ok' });
    expect(parseNotes('{bad')).toEqual({});
    expect(parseNotes(JSON.stringify([1, 2]))).toEqual({});
    expect(parseNotes(null)).toEqual({});
  });
});

describe('setNote', () => {
  it('adds / updates without mutating original', () => {
    const a = { AAPL: 'x' };
    const b = setNote(a, 'msft', 'new');
    expect(b).toEqual({ AAPL: 'x', MSFT: 'new' });
    expect(a).toEqual({ AAPL: 'x' });
  });
  it('empty / whitespace text removes the key', () => {
    expect(setNote({ AAPL: 'x', MSFT: 'y' }, 'AAPL', '   ')).toEqual({ MSFT: 'y' });
    expect(setNote({ AAPL: 'x' }, 'AAPL', '')).toEqual({});
  });
  it('blank symbol is a no-op clone', () => {
    expect(setNote({ AAPL: 'x' }, '  ', 'z')).toEqual({ AAPL: 'x' });
  });
});
