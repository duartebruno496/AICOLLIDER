import type { ReactNode } from "react";

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose?: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`${wide ? "max-w-4xl" : "max-w-lg"} w-full max-h-[85dvh] overflow-y-auto rounded-2xl border border-surface-600 bg-surface-800 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-600 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          {onClose && (
            <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-surface-700 hover:text-slate-100" aria-label="Fechar">
              ✕
            </button>
          )}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary: "bg-sky-600 hover:bg-sky-500 text-white",
    secondary: "bg-surface-700 hover:bg-surface-600 text-slate-100",
    danger: "bg-rose-600 hover:bg-rose-500 text-white",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white",
    ghost: "bg-transparent hover:bg-surface-700 text-slate-200",
  };
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation select-none ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "mt-1 w-full rounded-xl border border-surface-600 bg-surface-900 px-3 py-2.5 min-h-11 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500";