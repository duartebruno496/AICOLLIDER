import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
  stack: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: "" };

  static getDerivedStateFromError(error: Error): State {
    return { error, stack: "" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AICOLLIDER] Erro não tratado:", error, info.componentStack);
    this.setState({ stack: info.componentStack ?? "" });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-6">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-surface-900 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-2xl">⚠️</div>
            <h1 className="text-lg font-bold text-white">Ops, algo deu errado</h1>
            <p className="mt-2 break-words text-sm text-slate-400">{this.state.error.message}</p>
            {this.state.stack && (
              <details className="mt-3 text-left">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">Detalhes técnicos</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2 text-[10px] leading-relaxed text-slate-500">
                  {this.state.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                this.setState({ error: null });
                location.reload();
              }}
              className="mt-5 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Recarregar
            </button>
            <button
              onClick={() => {
                try {
                  Object.keys(localStorage)
                    .filter((k) => k.startsWith("aicollider:"))
                    .filter((k) => k !== "aicollider:session")
                    .forEach((k) => localStorage.removeItem(k));
                } catch {
                  /* ignore */
                }
                location.reload();
              }}
              className="mt-2 block w-full rounded-xl border border-slate-700 px-6 py-2 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300"
            >
              Resetar configurações locais (mantém login)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
