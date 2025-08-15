import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("App crash:", error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-red-700">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <pre className="mt-3 whitespace-pre-wrap text-sm">
            {String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
