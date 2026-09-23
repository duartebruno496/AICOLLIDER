import { useEffect, useRef, useState } from "react";
import { Bot, Cpu, SendHorizonal, KeyRound, Loader2, MessageSquare, Wrench } from "lucide-react";
import { useAppStore, uid } from "../store/useAppStore";
import { simpleChat, providerAvailable } from "../lib/llm";
import { Orchestrator } from "../agents/orchestrator";
import { buildProvider } from "../lib/llm";
import { loadChat, saveChatDebounced } from "../lib/chatDb";
import { localModelSupportsTools } from "../lib/llm/providers/local";
import type { ChatMessage, ChatMode, RemoteVendor } from "../types";

const KEY_URLS: Record<RemoteVendor, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  gemini: "https://aistudio.google.com/app/apikey",
  openrouter: "https://openrouter.ai/keys",
  groq: "https://console.groq.com/keys",
};

const KEY_HINTS: Record<RemoteVendor, string> = {
  openai: "platform.openai.com",
  anthropic: "console.anthropic.com",
  gemini: "aistudio.google.com",
  openrouter: "openrouter.ai/keys",
  groq: "console.groq.com",
};

export function ChatPanel({ repo }: { repo: string | null }) {
  const {
    chat, appendChat, replaceChat, agentRunning, setAgentRunning, vendor, setVendor,
    activeRepo, setToast, localProgress, apiKeys, setApiKey, localModel,
  } = useAppStore();
  const [input, setInput] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [msgMode, setMsgMode] = useState<ChatMode>(() => useAppStore.getState().chatMode);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chat, agentRunning]);

  useEffect(() => {
    let cancelled = false;
    replaceChat([]);
    void (async () => {
      const stored = repo ? await loadChat(repo) : [];
      if (!cancelled) replaceChat(stored);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  useEffect(() => {
    if (repo && chat.length > 0) saveChatDebounced(repo, chat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, repo]);

  const canAgent = !!activeRepo && msgMode === "agent";
  const available = providerAvailable();
  const remoteVendor = vendor !== "local" ? (vendor as RemoteVendor) : null;
  const hasKey = remoteVendor ? (apiKeys[remoteVendor] ?? "").trim().length > 0 : true;

  function saveKey() {
    const k = keyDraft.trim();
    if (!remoteVendor || !k) return;
    setApiKey(remoteVendor, k);
    setKeyDraft("");
    setToast("Chave salva. IA ativada!");
  }

  async function send() {
    const text = input.trim();
    if (!text || agentRunning || !available) return;
    setInput("");
    appendChat({ id: uid(), role: "user", content: text });
    setAgentRunning(true);
    try {
      if (canAgent && repo) {
        const provider = buildProvider();
        const orch = new Orchestrator(provider, repo);
        const { finalText, appliedChanges } = await orch.run(chat.concat([{ id: uid(), role: "user", content: text }]));
        appendChat({ id: uid(), role: "assistant", content: finalText });
        if (appliedChanges > 0) setToast(`${appliedChanges} alteração(ões) aprovada(s) e commitada(s).`);
      } else {
        const sysCtx = repo
          ? `Repositório virtual aberto: ${repo}. Você está em MODO CONVERSA (sem tools): responda com base no histórico e contexto; NÃO invente conteúdo de arquivos ou do projeto. Para editar código, o usuário muda para o modo Agente.`
          : "Você é o assistente do AICOLLIDER (editor + IA no navegador). Responda em português, de forma objetiva.";
        const history: ChatMessage[] = [
          { id: uid(), role: "system", content: sysCtx },
          ...chat,
          { id: uid(), role: "user", content: text },
        ];
        const { assistant } = await simpleChat(history);
        appendChat({ id: uid(), role: "assistant", content: assistant });
      }
    } catch (e) {
      appendChat({
        id: uid(),
        role: "assistant",
        content: `⚠️ ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setAgentRunning(false);
    }
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-surface-600 bg-surface-900/70 md:w-96 md:shrink-0">
      <div className="flex items-center justify-between gap-2 border-b border-surface-600 px-3 py-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Bot className="h-4 w-4 text-emerald-400" /> Chat & Agente
        </span>
        <select
          value={vendor}
          onChange={(e) => setVendor(e.target.value as never)}
          className="rounded-lg border border-surface-600 bg-surface-800 px-2 py-1 text-xs text-slate-200 outline-none"
          title="Provedor de IA"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Gemini</option>
          <option value="openrouter">OpenRouter (modelos grátis :free)</option>
          <option value="groq">Groq (grátis)</option>
          <option value="local">Local (WebGPU)</option>
        </select>
      </div>

      {vendor === "local" && localProgress.loading && (
        <div className="border-b border-surface-600 bg-sky-500/10 px-3 py-2">
          <div className="mb-1 flex items-center gap-2 text-xs text-sky-200">
            <Cpu className="h-3.5 w-3.5 animate-pulse" /> {localProgress.text}
            <span className="ml-auto">{Math.round(localProgress.progress * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-700">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.round(localProgress.progress * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-surface-600 px-3 py-1.5">
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
          Conversa primeiro: o modo <b className="text-slate-300">Agente</b> é escolhido por mensagem, logo abaixo.
        </p>
      </div>

      {vendor === "local" && msgMode === "agent" && !localModelSupportsTools(localModel) && (
        <p className="border-b border-surface-600 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
          Este modelo usa <b>tool calling manual</b> — o Modo Agente funciona, porém com menos confiabilidade. <b>Hermes 3</b> usa tools nativos (recomendado).
        </p>
      )}

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {chat.length === 0 && (
          <p className="rounded-xl border border-dashed border-surface-600 p-4 text-center text-xs text-slate-500">
            {canAgent ? (
              <>
                Peça algo como:
                <br />
                <em className="text-slate-400">"Crie um arquivo readme.md com um título"</em>
                <br />
                A IA lê a pasta, propõe o diff e aguarda o seu clique para salvar.
              </>
            ) : (
              <>
                Converse normalmente. Quando quiser que a IA manipule o repositório, escolha{" "}
                <em className="text-slate-400">"Agente"</em> ao lado do campo de mensagem.
              </>
            )}
          </p>
        )}
        {chat.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-sky-600 text-white" : "border border-surface-600 bg-surface-800 text-slate-200"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {agentRunning && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-surface-600 bg-surface-800 px-3 py-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {canAgent ? "IA executando tools (aguardando aprovações humanas)..." : "IA pensando..."}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-surface-600 p-3">
        {remoteVendor && !hasKey && (
          <div className="mb-2 space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-200">
              <KeyRound className="h-3.5 w-3.5 shrink-0" /> Ative a IA grátis — 30 segundos, sem cartão
            </p>
            <p className="text-xs leading-relaxed text-emerald-300/90">
              1. Crie uma chave gratuita em{" "}
              <a href={KEY_URLS[remoteVendor]} target="_blank" rel="noreferrer" className="font-medium underline hover:text-emerald-100">
                {KEY_HINTS[remoteVendor]}
              </a>{" "}
              · 2. Cole abaixo para ativar:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveKey();
                  }
                }}
                placeholder="Cole sua chave de API"
                className="min-w-0 flex-1 rounded-lg border border-surface-600 bg-surface-900 px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
              />
              <button
                onClick={saveKey}
                disabled={!keyDraft.trim()}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 touch-manipulation"
              >
                Ativar
              </button>
            </div>
            {remoteVendor === "openrouter" && (
              <p className="text-[11px] text-emerald-300/70">
                O modelo padrão já usa a rota grátis (deepseek-chat-v3.1:free) — grátis e com agentes. Outras IAs e ajustes
                ficam no Dashboard de controle.
              </p>
            )}
          </div>
        )}
        {!available && hasKey && (
          <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-xs text-amber-300">
            <Cpu className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            WebGPU indisponível neste navegador. Use Chrome/Edge recente ou escolha um provedor remoto no seletor acima.
          </p>
        )}
        <div className="mb-2 flex items-center gap-1 rounded-xl border border-surface-600 bg-surface-800 p-1">
          {(["chat", "agent"] as ChatMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMsgMode(m)}
              disabled={m === "agent" && !activeRepo}
              title={m === "agent" && !activeRepo ? "Abra um repositório para usar o agente" : undefined}
              className={`flex flex-1 min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold touch-manipulation disabled:opacity-40 ${
                msgMode === m ? "bg-emerald-600 text-white" : "text-slate-400 hover:bg-surface-700 hover:text-slate-200"
              }`}
            >
              {m === "chat" ? <MessageSquare className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
              {m === "chat" ? "Conversar" : "Agente"}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={canAgent ? "Instruções de vibe coding..." : "Mensagem..."}
            className="max-h-32 min-h-12 flex-1 resize-none rounded-xl border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500 touch-manipulation"
          />
          <button
            onClick={() => void send()}
            disabled={agentRunning || !input.trim() || !available}
            className="flex min-h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 touch-manipulation"
            aria-label="Enviar"
          >
            {agentRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </aside>
  );
}