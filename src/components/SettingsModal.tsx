import { useState } from "react";
import { KeyRound, Database, Cpu } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { Modal, Button, Field, inputCls } from "./common";

const LOCAL_MODELS = [
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Phi-3.5-mini-instruct-q4f16_1-MLC",
];

export function SettingsModal() {
  const {
    showSettings,
    setShowSettings,
    supabaseConfig,
    setSupabaseConfig,
    apiKeys,
    setApiKey,
    vendor,
    setVendor,
    localModel,
    setLocalModel,
    setToast,
    gitToken,
    authSource,
  } = useAppStore();

  const [url, setUrl] = useState(supabaseConfig.url);
  const [anonKey, setAnonKey] = useState(supabaseConfig.anonKey);
  const [keys, setKeys] = useState({ ...apiKeys });

  function saveSupabase() {
    if (url.trim() && anonKey.trim()) {
      setSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() });
      setToast("Credenciais do Supabase salvas.");
    }
  }

  function saveKeys() {
    (["openai", "anthropic", "gemini"] as const).forEach((v) => setApiKey(v, keys[v].trim()));
    setToast("Chaves de IA salvas no localStorage (BYOK).");
  }

  return (
    <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Configurações" wide>
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Database className="h-4 w-4 text-sky-400" /> Supabase (banco opcional)
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Não é usado para login: o AICOLLIDER autentica com <b>GitHub OAuth (Device Flow)</b> próprio. O Supabase entra
            quando você quiser um <b>banco Postgres</b> para o projeto — configure aqui (URL + anon key) quando for usá-lo.
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

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <KeyRound className="h-4 w-4 text-emerald-400" /> Chaves de IA (BYOK — localStorage)
          </h3>
          <p className="mb-3 text-xs text-slate-500">Guardadas apenas no seu navegador. Sem backend.</p>
          <div className="space-y-3">
            <Field label="OpenAI API Key">
              <input className={inputCls} type="password" value={keys.openai} onChange={(e) => setKeys((k) => ({ ...k, openai: e.target.value }))} placeholder="sk-..." />
            </Field>
            <Field label="Anthropic API Key">
              <input className={inputCls} type="password" value={keys.anthropic} onChange={(e) => setKeys((k) => ({ ...k, anthropic: e.target.value }))} placeholder="sk-ant-..." />
            </Field>
            <Field label="Gemini API Key">
              <input className={inputCls} type="password" value={keys.gemini} onChange={(e) => setKeys((k) => ({ ...k, gemini: e.target.value }))} placeholder="AIza..." />
            </Field>
          </div>
          <Button variant="secondary" onClick={saveKeys} className="mt-3">
            Salvar chaves
          </Button>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Cpu className="h-4 w-4 text-amber-400" /> Provedor Local (WebLLM / WebGPU)
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Sem chave? Ajuste o provedor no chat para <b>Local</b>. O modelo é baixado para o cache do navegador.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Modelo WebLLM">
              <select className={inputCls} value={localModel} onChange={(e) => setLocalModel(e.target.value)}>
                {LOCAL_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Provedor padrão">
              <select className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value as never)}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
                <option value="local">Local (WebGPU)</option>
              </select>
            </Field>
          </div>
        </section>
      </div>
    </Modal>
  );
}