import { useState } from "react";
import { KeyRound, Database, Cpu, Cloud, ShieldCheck } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { ApiKeys, RemoteVendor } from "../types";
import { DEFAULT_MODELS } from "../types";
import { Modal, Button, Field, inputCls } from "./common";

const LOCAL_MODELS = [
  "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
  "Hermes-3-Llama-3.1-8B-q4f32_1-MLC",
  "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC",
  "Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC",
  "Hermes-2-Pro-Mistral-7B-q4f16_1-MLC",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
];

const VENDOR_LABELS: Record<RemoteVendor, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  groq: "Groq",
};

const VENDOR_HINTS: Record<RemoteVendor, string> = {
  openai: "platform.openai.com → API keys (sk-...)",
  anthropic: "console.anthropic.com → API keys (sk-ant-...)",
  gemini: "aistudio.google.com → Get API key (AIza...)",
  openrouter: "openrouter.ai → Keys (free models disponíveis)",
  groq: "console.groq.com → keys (gsk_...)",
};

const VENDOR_URLS: Record<RemoteVendor, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
};

export function SettingsModal() {
  const {
    showSettings,
    setShowSettings,
    supabaseConfig,
    setSupabaseConfig,
    apiKeys,
    setApiKey,
    models,
    setModel,
    vendor,
    setVendor,
    localModel,
    setLocalModel,
    syncApiKeys,
    setSyncApiKeys,
    profileLastSync,
    setToast,
    gitToken,
    gitUsername,
    authSource,
  } = useAppStore();

  const [url, setUrl] = useState(supabaseConfig.url);
  const [anonKey, setAnonKey] = useState(supabaseConfig.anonKey);
  const KEYS_DEFAULTS: ApiKeys = { openai: "", anthropic: "", gemini: "", openrouter: "", groq: "" };
  const MODELS_DEFAULTS = { ...DEFAULT_MODELS };
  const [keys, setKeys] = useState<ApiKeys>(() => ({ ...KEYS_DEFAULTS, ...apiKeys }));
  const [selModel, setSelModel] = useState(() => ({ ...MODELS_DEFAULTS, ...models }));

  function saveSupabase() {
    if (url.trim() && anonKey.trim()) {
      setSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() });
      setToast("Credenciais do Supabase salvas.");
    }
  }

  function saveKeys() {
    (Object.keys(keys) as Array<keyof typeof keys>).forEach((v) => setApiKey(v, keys[v].trim()));
    setToast("Chaves de IA salvas no localStorage (BYOK).");
  }

  function saveModels() {
    (Object.keys(selModel) as RemoteVendor[]).forEach((v) => setModel(v, selModel[v].trim()));
    setToast("Modelos salvos.");
  }

  const activeRemote = vendor !== "local" ? (vendor as RemoteVendor) : null;

  return (
    <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Configurações" wide>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <KeyRound className="h-4 w-4 text-emerald-400" /> Provedor padrão do chat
          </h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <button
              onClick={() => setVendor("local")}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium touch-manipulation ${
                vendor === "local" ? "border-amber-400 bg-amber-500/10 text-amber-200" : "border-surface-600 bg-surface-800 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span className="block font-semibold">Local (WebGPU)</span>
              <span className="block text-[11px] text-slate-500">grátis · sem chave</span>
            </button>
            {(Object.keys(VENDOR_LABELS) as RemoteVendor[]).map((v) => (
              <button
                key={v}
                onClick={() => setVendor(v)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium touch-manipulation ${
                  vendor === v ? "border-emerald-400 bg-emerald-500/10 text-emerald-200" : "border-surface-600 bg-surface-800 text-slate-300 hover:border-slate-500"
                }`}
              >
                <span className="block font-semibold">{VENDOR_LABELS[v]}</span>
                <span className="block truncate text-[11px] text-slate-500">{apiKeys[v] ? "chave OK" : "sem chave"}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            O <b>GitHub Models</b> (grátis com token GitHub) foi <b>aposentado em 30/07/2026</b> — usamos WebLLM local ou
            chaves BYOK. Para testar sem pagar: OpenRouter tem modelos <b>free</b> (basta criar conta e gerar uma chave).
          </p>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <KeyRound className="h-4 w-4 text-emerald-400" /> Chaves de IA (BYOK)
          </h3>
          <p className="mb-3 text-xs text-slate-500">Guardadas no seu navegador e, se você ativar, no seu perfil na nuvem.</p>
          <div className="space-y-2">
            {(Object.keys(VENDOR_LABELS) as RemoteVendor[]).map((v) => (
              <Field key={v} label={`${VENDOR_LABELS[v]} — API Key`}>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    type="password"
                    value={keys[v]}
                    onChange={(e) => setKeys((k) => ({ ...k, [v]: e.target.value }))}
                    placeholder={VENDOR_HINTS[v]}
                  />
                  <button
                    type="button"
                    onClick={() => setVendor(v)}
                    disabled={!(keys[v] ?? "").trim()}
                    className="shrink-0 rounded-xl border border-surface-600 px-3 text-xs text-slate-400 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-40 touch-manipulation"
                  >
                    usar
                  </button>
                </div>
              </Field>
            ))}
          </div>
          <Button variant="secondary" onClick={saveKeys} className="mt-3">
            Salvar chaves
          </Button>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Cpu className="h-4 w-4 text-amber-400" /> Modelos
          </h3>
          <p className="mb-3 text-xs text-slate-500">Escolha o modelo do provedor padrão. O <b>Local</b> é baixado para o cache do navegador.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {activeRemote ? (
              <Field label={`Modelo ${VENDOR_LABELS[activeRemote]}`}>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    value={selModel[activeRemote]}
                    onChange={(e) => setSelModel((m) => ({ ...m, [activeRemote]: e.target.value }))}
                    placeholder={DEFAULT_MODELS[activeRemote]}
                  />
                  <Button variant="secondary" onClick={saveModels} className="shrink-0">
                    salvar
                  </Button>
                </div>
              </Field>
            ) : (
              <Field label="Modelo WebLLM">
                <select className={inputCls} value={localModel} onChange={(e) => setLocalModel(e.target.value)}>
                  {(LOCAL_MODELS.includes(localModel) ? LOCAL_MODELS : [localModel, ...LOCAL_MODELS]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-slate-500">Hermes 3 usa tools nativos; Hermes 2 e os leves (Qwen/Llama) usam tool calling manual — menos confiáveis no Modo Agente.</span>
              </Field>
            )}
            <Field label="Endpoint usado">
              <input className={inputCls} readOnly value={activeRemote ? VENDOR_URLS[activeRemote] : "WebLLM (100% no navegador)"} />
            </Field>
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Cloud className="h-4 w-4 text-sky-400" /> Perfil na nuvem (por usuário)
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Suas configurações seguem você entre dispositivos: o app salva um <code className="rounded bg-surface-900 px-1">profile.json</code>{" "}
            num repositório <b>privado</b> seu chamado <code className="rounded bg-surface-900 px-1">aicollider-profile</code> (criado
            automaticamente com o seu token). Projetos, provedor, modelos e último repositório aberto são restaurados no próximo login.
          </p>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-600 bg-surface-900/60 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 touch-manipulation">
              <input type="checkbox" checked={syncApiKeys} onChange={(e) => setSyncApiKeys(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Sincronizar chaves de IA no perfil
            </label>
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              {gitUsername ? `perfil: ${gitUsername}` : "entre para ativar"}
            </span>
            {profileLastSync && <span className="text-[11px] text-slate-500">última sincronização: {profileLastSync}</span>}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            As chaves ficam em texto plano num repo privado seu — por isso a sincronização delas vem <b>desligada</b> por padrão.
          </p>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Database className="h-4 w-4 text-sky-400" /> Supabase (banco opcional)
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Não é usado para login: o AICOLLIDER autentica com <b>GitHub</b>. O Supabase entra quando você quiser um{" "}
            <b>banco Postgres</b> para o projeto.
          </p>
          <p className="mb-3 text-xs text-slate-500">
            {gitToken
              ? `Token GitHub ativo (memória): ${gitToken.slice(0, 12)}…${gitToken.slice(-4)} — origem: ${
                  authSource === "device"
                    ? "GitHub OAuth (Device Flow)"
                    : authSource === "supabase"
                      ? "GitHub OAuth via Supabase (provider_token)"
                      : "token manual (modo teste)"
                }. Não é persistido.`
              : "Sem sessão ativa. Entre com a conta GitHub na tela de login."}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Supabase URL">
              <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
            </Field>
            <Field label="Anon Key">
              <input className={inputCls} value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJhbGci..." />
            </Field>
          </div>
          <Button variant="secondary" onClick={saveSupabase} className="mt-3">
            Salvar Supabase
          </Button>
        </section>
      </div>
    </Modal>
  );
}