import { Component, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error?: Error };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) {
    console.error("ErrorBoundary caught", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <div className="card p-6">
            <h1 className="text-xl font-semibold mb-3">Something went wrong</h1>
            <p className="text-sm text-slate-600 mb-3">
              The app hit an unexpected error. The technical message is below to help with debugging.
            </p>
            <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 overflow-auto text-xs">
{String(this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
