import React from 'react';

/**
 * Per-widget error boundary so one crashing fundamentals widget doesn't
 * take down the whole result card.
 *
 * Why per-widget: the Analysis result card composes ~15 different
 * widgets, each reading a different slice of the EODHD payload. Any
 * one widget hitting an unexpected data shape (missing field, array
 * vs record, null in a sort key) used to crash the entire card and
 * make the lookup look "broken." Wrapping each widget in this boundary
 * isolates failures so the user still sees every other section.
 *
 * In dev, the failure surfaces as a tiny inline note with the error
 * message so we can fix it. In prod, the offending section just
 * disappears (graceful degradation).
 */

interface Props {
  children: React.ReactNode;
  /** Short label for the widget — shown in the dev fallback message. */
  name?:    string;
}

interface State {
  error: Error | null;
}

export class WidgetBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Log so we can surface it in the console / monitoring without
    // breaking the page.
    // eslint-disable-next-line no-console
    console.error(`[Analysis widget ${this.props.name ?? 'unknown'}] crashed:`, error);
  }

  render() {
    if (this.state.error) {
      if (import.meta.env.DEV) {
        return (
          <div className="text-[10px] text-amber-400 font-mono pt-3 border-t border-border">
            ⚠ {this.props.name ?? 'Widget'}: {this.state.error.message}
          </div>
        );
      }
      return null; // silent in prod — graceful degradation
    }
    return this.props.children;
  }
}
