import { useMemo, useState } from "react";
import { Bot, Download, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { AgentProfile, AgentSkill } from "../agents/registry";
import { getAgents, getSkills } from "../agents/registry";
import { TOOLS } from "../agents/tools";
import { Field, Button, inputCls } from "./common";

const EMPTY_AGENT: AgentProfile = {
  id: "",
  name: "",
  role: "",
  emoji: "🤖",
  description: "",
  skills: ["read-repo"],
  rolePrompt: "",
};

const ID_RE = /^[a-z0-9-]{1,50}$/;

function isStrArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Valida e normaliza um agente importado (schema mínimo, protege contra JSON malicioso/inválido). */
function sanitizeAgent(raw: unknown): AgentProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Partial<AgentProfile>;
  const id = String(a.id ?? "").trim().toLowerCase();
  if (!ID_RE.test(id) || id.startsWith("_")) return null;
  const name = typeof a.name === "string" ? a.name.trim().slice(0, 80) : id;
  const role = typeof a.role === "string" ? a.role.trim().slice(0, 60) : "assistente";
  const emoji = typeof a.emoji === "string" && a.emoji.trim() ? a.emoji.trim().slice(0, 8) : "🤖";
  const description = typeof a.description === "string" ? a.description.trim().slice(0, 200) : "";
  const skills = isStrArray(a.skills) ? a.skills.filter((s) => ID_RE.test(s)).slice(0, 12) : [];
  const rolePrompt = typeof a.rolePrompt === "string" ? a.rolePrompt.slice(0, 8000) : "";
  if (skills.length === 0) return null;
  return { id, name, role, emoji, description, skills, rolePrompt };
}

/** Valida e normaliza uma skill importada. */
function sanitizeSkill(raw: unknown): AgentSkill | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<AgentSkill>;
  const id = String(s.id ?? "").trim().toLowerCase();
  if (!ID_RE.test(id) || id.startsWith("_")) return null;
  const name = typeof s.name === "string" ? s.name.trim().slice(0, 80) : id;
  const description = typeof s.description === "string" ? s.description.trim().slice(0, 200) : "";
  const allowedTools = isStrArray(s.allowedTools) ? s.allowedTools.slice(0, 8) : [];
  const instructions = typeof s.instructions === "string" ? s.instructions.slice(0, 8000) : "";
  const skill: AgentSkill = { id, name, description, allowedTools, instructions };
  if (allowedTools.some((t) => !TOOLS.some((tool) => tool.function.name === t))) return null;
  return skill;
}

export function AgentsPanel() {
  const { customAgents, setCustomAgents, customSkills, setCustomSkills, setToast } = useAppStore();
  const [editing, setEditing] = useState<AgentProfile | null>(null);
  const [skillOpen, setSkillOpen] = useState(false);
  const agents = useMemo(() => getAgents(), [customAgents]);
  const skills = getSkills();

  function exportAll() {
    const payload = { agents: customAgents, skills: customSkills };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aicollider-agents.json";
    a.click();
    URL.revokeObjectURL(url);
    setToast("JSON de agentes/skills exportado.");
  }

  function importAll(file: File) {
    if (file.size > 200_000) {
      setToast("Arquivo muito grande (máx. 200KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as { agents?: unknown; skills?: unknown };
        const agents = Array.isArray(data.agents) ? data.agents.map(sanitizeAgent).filter(Boolean) as AgentProfile[] : [];
        const skills = Array.isArray(data.skills) ? data.skills.map(sanitizeSkill).filter(Boolean) as AgentSkill[] : [];
        if (agents.length === 0 && skills.length === 0) {
          setToast("JSON sem agentes/skills válidos.");
          return;
        }
        if (agents.length) setCustomAgents(agents);
        if (skills.length) setCustomSkills(skills);
        setToast(`Importação concluída (${agents.length} agentes, ${skills.length} skills).`);
      } catch {
        setToast("JSON inválido.");
      }
    };
    reader.readAsText(file);
  }

  function save(newAgent: AgentProfile) {
    const valid = sanitizeAgent(newAgent);
    if (!valid) {
      setToast("Id inválido (use a-z, números e hífen; máx. 50) ou selecione ao menos 1 skill.");
      return;
    }
    const list = [...customAgents.filter((a) => a.id !== valid.id), valid];
    setCustomAgents(list);
    setEditing(null);
    setToast(`Agente '${valid.name || valid.id}' salvo.`);
  }

  function remove(id: string) {
    setCustomAgents(customAgents.filter((a) => a.id !== id));
    setToast("Agente removido (built-in restaurado se existir).");
  }

  return (
    <>
      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Users className="h-4 w-4 text-sky-400" /> Agentes
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={exportAll} className="!px-2 !py-1 text-xs">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
            <label className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg border border-surface-600 bg-surface-700 px-2 text-xs font-semibold text-slate-200 hover:bg-surface-600 touch-manipulation">
              <Upload className="h-3.5 w-3.5" /> Importar
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => {
                if (e.target.files?.[0]) importAll(e.target.files[0]);
                e.target.value = "";
              }} />
            </label>
            <Button variant="success" onClick={() => setEditing({ ...EMPTY_AGENT })} className="!px-2 !py-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Novo
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Crie/edite agentes e skills como JSON. Agentes customizados sobrescrevem os built-in com o mesmo id. São dados
          locais (IndexedDB), nunca executados como código. Ao importar JSON de terceiros, revise os prompts (
          <b className="text-amber-300">rolePrompt/instructions</b>) antes de usar.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {agents.map((a) => {
            const isCustom = customAgents.some((c) => c.id === a.id);
            return (
              <div key={a.id} className="rounded-xl border border-surface-600 bg-surface-900/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <span>{a.emoji}</span> {a.name}
                    <span className="rounded bg-surface-700 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">{a.id}</span>
                    {isCustom && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">custom</span>}
                  </p>
                  <div className="flex gap-1">
                    {isCustom && (
                      <button onClick={() => remove(a.id)} aria-label={`Remover agente ${a.name}`} className="flex h-9 w-9 items-center justify-center rounded p-2 text-slate-400 hover:text-red-400 touch-manipulation" title="Remover (volta ao built-in)">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => setEditing({ ...a })} aria-label={`Editar agente ${a.name}`} className="flex h-9 w-9 items-center justify-center rounded p-2 text-slate-400 hover:text-sky-300 touch-manipulation" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-400">{a.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.skills.map((s) => (
                    <span key={s} className="rounded bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">{s}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <details open={skillOpen} onToggle={(e) => setSkillOpen(e.currentTarget.open)} className="group">
          <summary className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 py-1 touch-manipulation">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Bot className="h-4 w-4 text-sky-400" /> Skills ({Object.keys(skills).length})
            </h3>
            <span className="text-xs text-slate-400">{skillOpen ? "ocultar" : "ver"}</span>
          </summary>
          <ul className="mt-3 space-y-2">
            {Object.values(skills).map((s) => (
              <li key={s.id} className="rounded-lg border border-surface-600 bg-surface-900/60 px-3 py-2">
                <p className="text-xs font-semibold text-slate-200">{s.name} <span className="font-mono text-[11px] text-sky-300">{s.id}</span></p>
                <p className="text-xs text-slate-400">{s.description}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">tools: {s.allowedTools.join(", ") || "nenhuma (só regras)"}</p>
              </li>
            ))}
          </ul>
        </details>
      </section>

      {editing && (
        <AgentEditor
          agent={editing}
          onSave={save}
          onClose={() => setEditing(null)}
          existingIds={agents.map((a) => a.id)}
        />
      )}
    </>
  );
}

function AgentEditor({ agent, onSave, onClose, existingIds }: {
  agent: AgentProfile;
  onSave: (a: AgentProfile) => void;
  onClose: () => void;
  existingIds: string[];
}) {
  const [draft, setDraft] = useState<AgentProfile>(agent);
  const allSkillNames = Object.keys(getSkills());

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="agent-editor-title">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 id="agent-editor-title" className="mb-4 text-sm font-semibold text-slate-200">Editar agente</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Id (ex.: security)">
            <input className={inputCls} value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="my-agent" />
          </Field>
          <Field label="Nome">
            <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Emoji">
            <input className={inputCls} value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} />
          </Field>
          <Field label="Papel (curto)">
            <input className={inputCls} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Descrição">
              <input className={inputCls} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Prompt de papel (instruções do agente)">
              <textarea
                className={inputCls}
                rows={5}
                value={draft.rolePrompt}
                onChange={(e) => setDraft({ ...draft, rolePrompt: e.target.value })}
                placeholder="Você é... comece com um plano curto..."
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-200">Skills (liberam tools)</span>
            <div className="flex flex-wrap gap-2">
              {allSkillNames.map((s) => (
                <label key={s} className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-surface-600 bg-surface-900/60 px-2 py-1 text-xs text-slate-300 touch-manipulation">
                  <input
                    type="checkbox"
                    checked={draft.skills.includes(s)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        skills: e.target.checked ? [...draft.skills, s] : draft.skills.filter((x) => x !== s),
                      })
                    }
                    className="h-4 w-4 accent-sky-500"
                  />
                  <span className="font-mono">{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {existingIds.includes(draft.id) && draft.id !== agent.id && (
          <p className="mt-2 text-xs text-amber-300">Um agente com id "{draft.id}" já existe — ele será sobrescrito.</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="success" onClick={() => onSave(draft)}>Salvar agente</Button>
        </div>
      </div>
    </div>
  );
}