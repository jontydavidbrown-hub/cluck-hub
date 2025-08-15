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
        <div className="p-6">
          <h1 className="text-xl font-semibold mb-2">Unexpected Application Error</h1>
          <pre className="p-3 rounded bg-slate-100 text-slate-800 overflow-auto">
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
