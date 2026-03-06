/**
 * Adapter Registry
 *
 * Central registry for brokerage statement adapters.
 * Handles auto-detection by running each adapter's detect()
 * against sample lines and selecting the best match.
 *
 * @module registry
 */

import type { StatementAdapter, ParsedStatement } from './types';
import { splitLines } from './tokenizer';

const DETECTION_SAMPLE_SIZE = 15;

class AdapterRegistry {
  private adapters: StatementAdapter[] = [];

  /**
   * Register a new adapter. Adapters are automatically sorted
   * by priority (descending) so higher-priority adapters are
   * tried first during detection.
   */
  register(adapter: StatementAdapter): void {
    this.adapters.push(adapter);
    this.adapters.sort((a, b) => b.priority - a.priority);
  }

  /** Get all registered adapters */
  getAdapters(): readonly StatementAdapter[] {
    return this.adapters;
  }

  /** Get a specific adapter by id */
  getAdapter(id: string): StatementAdapter | undefined {
    return this.adapters.find(a => a.id === id);
  }

  /**
   * Auto-detect the best adapter for the given text.
   * Returns the adapter with the highest confidence score,
   * or undefined if no adapter scores above the threshold.
   */
  detect(lines: string[], threshold = 0.3): StatementAdapter | undefined {
    const sample = lines.slice(0, DETECTION_SAMPLE_SIZE);
    let best: StatementAdapter | undefined;
    let bestScore = threshold;

    for (const adapter of this.adapters) {
      const score = adapter.detect(sample);
      if (score > bestScore) {
        bestScore = score;
        best = adapter;
        if (score >= 1.0) break; // Perfect match, stop early
      }
    }

    return best;
  }

  /**
   * Parse CSV text, auto-detecting the format.
   * If forceAdapter is specified, uses that adapter directly.
   */
  parse(text: string, forceAdapterId?: string): ParsedStatement {
    const t0 = performance.now();
    const lines = splitLines(text);

    let adapter: StatementAdapter | undefined;
    if (forceAdapterId) {
      adapter = this.getAdapter(forceAdapterId);
      if (!adapter) {
        throw new Error(`Unknown adapter: ${forceAdapterId}`);
      }
    } else {
      adapter = this.detect(lines);
    }

    if (!adapter) {
      // Fall back to the lowest-priority adapter (should be 'generic')
      adapter = this.adapters[this.adapters.length - 1];
    }

    if (!adapter) {
      throw new Error('No adapters registered');
    }

    const result = adapter.parse(lines);
    const elapsed = performance.now() - t0;

    return {
      ...result,
      timing: {
        parseMs: Math.round(elapsed * 100) / 100,
        lineCount: lines.length,
      },
    };
  }
}

/** Singleton registry instance */
export const registry = new AdapterRegistry();
