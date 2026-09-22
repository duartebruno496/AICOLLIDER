import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[AICOLLIDER] Erro não tratado:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-6">
          <div className="w-full max-w-md rounded-3xl border border-rose-500/40 bg-surface-900 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-2xl">⚠️</div>
            <h1 className="text-lg font-bold text-white">Ops, algo deu errado</h1>
            <p className="mt-2 break-words text-sm text-slate-400">{this.state.error.message}</p>
            <button
              onClick={() => {
                this.setState({ error: null });
                location.reload();
              }}
              className="mt-5 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}