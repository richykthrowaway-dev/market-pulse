import { describe, it, expect } from 'vitest';
import { addSym, removeSym } from '@/hooks/useWatchlist';

describe('watchlist reducers', () => {
  it('adds normalized (trim+upper), dedups case-insensitively', () => {
    expect(addSym(['AAPL'], ' aapl ')).toEqual(['AAPL']);
    expect(addSym(['AAPL'], 'msft')).toEqual(['AAPL', 'MSFT']);
  });
  it('ignores empty', () => {
    expect(addSym(['AAPL'], '   ')).toEqual(['AAPL']);
  });
  it('removes by normalized symbol', () => {
    expect(removeSym(['AAPL', 'MSFT'], 'aapl')).toEqual(['MSFT']);
  });
});
