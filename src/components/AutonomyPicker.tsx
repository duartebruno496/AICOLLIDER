import type { AutonomyLevel } from "../types";
import { useAppStore } from "../store/useAppStore";

const OPTIONS: { value: AutonomyLevel; label: string; hint: string }[] = [
  { value: "guided", label: "Guided", hint: "Executa só com comando explícito" },
  { value: "proposed", label: "Proposed", hint: "Propõe plano, você aprova, ele executa" },
  { value: "full", label: "Full", hint: "Detecta a tarefa e executa direto ao diff" },
];

export function AutonomyPicker({ repo }: { repo: string | null }) {
  const autonomyByRepo = useAppStore((s) => s.autonomyByRepo);
  const setAutonomy = useAppStore((s) => s.setAutonomy);
  if (!repo) return null;
  const value: AutonomyLevel = autonomyByRepo[repo] ?? "proposed";

  return (
    <div>
      <div className="flex gap-1 rounded-xl border border-surface-600 bg-surface-900 p-1" role="radiogroup" aria-label="Nível de autonomia do agente">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setAutonomy(repo, o.value)}
            title={o.hint}
            aria-pressed={value === o.value}
            className={`min-h-11 flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors touch-manipulation ${
              value === o.value ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-surface-700 hover:text-slate-200"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const AUTONOMY_HINTS: Record<AutonomyLevel, string> = {
  guided: "Paired: o agente só mexe no código quando você pedir explicitamente.",
  proposed: "Padrão: a IA planeja e espera seu OK antes de executar.",
  full: "Vibe coding: a IA já parte para execução; você aprova cada diff.",
};