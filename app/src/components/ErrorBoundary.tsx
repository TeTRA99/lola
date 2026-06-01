// Minimal error boundary. Wrap a subtree that can fail to mount (e.g. a lazy
// screen whose native module isn't resolvable) so the failure renders a calm
// fallback instead of crashing the whole app. In dev the redbox still shows;
// in production this is the safety net.

import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; fallback: ReactNode; onError?: (error: unknown) => void };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }): void {
    console.log('[ErrorBoundary] caught:', (error as { message?: string })?.message, info?.componentStack);
    this.props.onError?.(error);
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
