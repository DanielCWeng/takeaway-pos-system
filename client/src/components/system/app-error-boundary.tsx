import React from "react";
import { reportRenderError } from "../../lib/runtime-monitor";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportRenderError(error, info.componentStack ?? undefined);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md rounded-xl border border-slate-700 bg-slate-900/90 p-6">
          <h1 className="text-lg font-semibold">Session interrupted</h1>
          <p className="mt-2 text-sm text-slate-300">
            The POS hit an unexpected UI error. Your draft order is saved locally.
            Reload to continue.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            onClick={() => window.location.reload()}
          >
            Reload POS
          </button>
        </div>
      </div>
    );
  }
}
