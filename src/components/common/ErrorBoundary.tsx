import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  name?: string;
  fallback?: (reset: () => void) => ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Dependency-free error boundary. React requires a class for this.
 * Catches render/lifecycle errors in its subtree so one broken widget
 * degrades to a recoverable card instead of unmounting the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep this — it's the only signal when a widget dies in prod.
    console.error(`[ErrorBoundary:${this.props.name ?? 'unnamed'}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.reset);
      return (
        <div className="trading-card rounded-lg border border-border/60 p-4 text-sm">
          <p className="font-medium text-foreground">This panel hit an error.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The rest of the page is unaffected.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-3 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
