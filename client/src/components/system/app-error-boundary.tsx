import React from "react";
import { reportRenderError } from "../../lib/runtime-monitor";
import { Button } from "../ui/button";

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
      <div className="fixed inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm p-6 text-foreground z-[9999]">
        <div className="pos-panel max-w-lg w-full p-8 shadow-2xl border-2 border-destructive/20 ring-1 ring-destructive/10">
          <div className="flex flex-col gap-6 text-center">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Session interrupted</h1>
              <p className="text-lg font-medium text-muted-foreground">会话中断</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-relaxed">
                  The POS hit an unexpected UI error. Your draft order is saved locally. Reload to
                  continue.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  POS系统遇到意外的UI错误。您的草稿订单已在本地保存。请重新加载以继续。
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="default"
                size="lg"
                className="w-full text-base font-bold shadow-lg"
                onClick={() => window.location.reload()}
              >
                Reload POS / 重新加载
              </Button>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
              Emergency Recovery System • 紧急修复系统
            </p>
          </div>
        </div>
      </div>
    );
  }
}
