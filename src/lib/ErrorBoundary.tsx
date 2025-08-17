import React from "react";

type State = { error: any };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: any) {
    return { error };
  }

  componentDidCatch(error: any, info: any) {
    // Will show up in the browser console in production
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || String(this.state.error);
      return (
        <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>Something went wrong</h1>
          <div style={{ marginBottom: 12, color: "#b91c1c" }}>{message}</div>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: 12, borderRadius: 8 }}>
            {this.state.error?.stack || ""}
          </pre>
          <button
            onClick={() => location.reload()}
            style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 8 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
