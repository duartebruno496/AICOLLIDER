import { useEffect, useRef, useState } from "react";
import { Github, KeyRound, ExternalLink, Loader2, Check, AlertTriangle, Settings, ChevronDown } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { defaultDeviceCfg, requestDeviceCode, pollDeviceToken, fetchGitHubUser, type DeviceCode, type DeviceCfg } from "../lib/gitHubDeviceAuth";

const CFG_KEY = "aicollider:deviceCfg";

function loadStoredCfg(): DeviceCfg | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) {
      const c = JSON.parse(raw) as DeviceCfg;
      if (c.clientId && c.relay) return c;
    }
  } catch {
    /* ignore */
  }
  return defaultDeviceCfg();
}

export function LoginScreen({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const setGitToken = useAppStore((s) => s.setGitToken);
  const [cfg, setCfg] = useState<DeviceCfg | null>(() => loadStoredCfg());
  const [phase, setPhase] = useState<"idle" | "requesting" | "waiting" | "done">("idle");
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [busyToken, setBusyToken] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current !== null) window.clearTimeout(pollRef.current);
    };
  }, []);

  async function startLogin() {
    if (!cfg) {
      setShowSetup(true);
      setError("Para o login OAuth, cole abaixo o Client ID e a URL do relay (ou use a opção de token abaixo, que entra na hora).");
      return;
    }
    setError(null);
    setPhase("requesting");
    try {
      const c = await requestDeviceCode(cfg);
      setCode(c);
      setPhase("waiting");
      schedulePoll(c, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar o login.");
      setPhase("idle");
    }
  }

  function schedulePoll(c: DeviceCode, wait: number) {
    pollRef.current = window.setTimeout(() => {
      void (async () => {
        if (!cfg) return;
        try {
          const r = await pollDeviceToken(cfg, c.device_code, c.interval);
          if (!r.ok) {
            if (r.status === "slow_down") {
              schedulePoll(c, (r.interval ?? c.interval) * 1000);
            } else if (r.status === "expired") {
              setError("O código expirou. Inicie o login novamente.");
              setPhase("idle");
              setCode(null);
            } else if (r.status === "access_denied") {
              setError("Autorização negada no GitHub.");
              setPhase("idle");
              setCode(null);
            } else {
              schedulePoll(c, c.interval * 1000);
            }
            return;
          }
          const user = await fetchGitHubUser(r.accessToken).catch(() => null);
          setGitToken(r.accessToken, user?.login ?? null, user?.avatar_url ?? null, "device");
          setPhase("done");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Falha ao verificar o login.");
          setPhase("idle");
          setCode(null);
        }
      })();
    }, Math.max(500, wait));
  }

  function handleTokenLogin() {
    const t = token.trim();
    if (!t) return;
    setBusyToken(true);
    setError(null);
    // validar o token contra a API do GitHub (CORS aberto em api.github.com)
    void (async () => {
      try {
        const user = await fetchGitHubUser(t);
        setGitToken(t, user?.login ?? null, user?.avatar_url ?? null, "manual");
        setPhase("done");
      } catch {
        setError("Token inválido ou sem permissões. Crie em GitHub > Settings > Developer settings > Tokens (escopo 'repo').");
      } finally {
        setBusyToken(false);
      }
    })();
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-surface-900 via-slate-950 to-surface-900 p-4">
      <div className="w-full max-w-md rounded-3xl border border-surface-600 bg-surface-800/80 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-3xl font-black text-white">
            A
          </div>
          <h1 className="text-2xl font-bold text-white">AICOLLIDER</h1>
          <p className="mt-1 text-sm text-slate-400">Entre com sua conta GitHub para continuar</p>
        </div>

        {phase === "done" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-sm text-slate-300">Autenticado! Entrando no editor…</p>
          </div>
        )}

        {phase !== "done" && (
          <>
            {/* Entrada rápida: token GitHub */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <KeyRound className="h-4 w-4" /> Entrar agora com token GitHub
              </p>
              <p className="mb-2 text-xs text-slate-400">
                Sem setup: crie um token em <span className="text-slate-300">GitHub → Settings → Developer settings → Tokens</span>{" "}
                (escopo <code className="rounded bg-surface-900 px-1">repo</code>), cole abaixo e caia direto no editor.
              </p>
              <input
                className="w-full rounded-xl border border-surface-600 bg-surface-900 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && token.trim() && handleTokenLogin()}
              />
              <button
                onClick={handleTokenLogin}
                disabled={busyToken || !token.trim()}
                className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 touch-manipulation"
              >
                {busyToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Entrar e abrir o editor
              </button>
              <p className="mt-2 text-[11px] text-slate-500">O token fica só na sessão da aba (some ao fechar).</p>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-600">
              <div className="h-px flex-1 bg-surface-600" />
              ou login oficial
              <div className="h-px flex-1 bg-surface-600" />
            </div>

            {/* OAuth GitHub (opcional) */}
            <button
              onClick={() => void startLogin()}
              disabled={phase === "requesting"}
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#24292f] px-4 py-3.5 text-base font-semibold text-white hover:bg-[#2f3742] disabled:opacity-60 touch-manipulation"
            >
              {phase === "requesting" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Github className="h-5 w-5" />}
              Entrar com GitHub (OAuth)
            </button>

            {!cfg && (
              <button onClick={() => setShowSetup((v) => !v)} className="mt-2 flex w-full items-center justify-center gap-1 text-center text-xs text-slate-500 hover:text-slate-300">
                {showSetup ? "Ocultar configuração do OAuth" : "Configurar login OAuth (opcional — 5 min, uma única vez)"}
                <ChevronDown className={`h-3.5 w-3.5 transition ${showSetup ? "rotate-180" : ""}`} />
              </button>
            )}

            {(showSetup || (cfg && phase === "waiting")) && (
              <div className="mt-3 space-y-3">
                {!cfg ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        O GitHub exige um <b>OAuth App</b> seu + um relay (~20 linhas) para o Device Flow. Passos: (1){" "}
                        <a href="https://github.com/settings/applications/new" target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                          criar OAuth App
                        </a>{" "}
                        → marque <b>Enable Device Flow</b>, escopos <code className="rounded bg-surface-900 px-1">repo read:user</code>; (2) publique{" "}
                        <code className="rounded bg-surface-900 px-1">worker/oauth-relay.js</code> num Cloudflare Worker; (3) cole aqui embaixo.
                      </span>
                    </div>
                    <ManualCfg onSave={(c) => { setCfg(c); localStorage.setItem(CFG_KEY, JSON.stringify(c)); }} />
                  </div>
                ) : (
                  phase === "waiting" &&
                  code && (
                    <div className="space-y-3">
                      <p className="text-center text-sm text-slate-300">Confirme o código abaixo no GitHub:</p>
                      <div className="mx-auto w-fit rounded-2xl border-2 border-dashed border-sky-400 bg-surface-900 px-6 py-3 text-center font-mono text-2xl font-bold tracking-widest text-sky-300">
                        {code.user_code}
                      </div>
                      <a
                        href={code.verification_uri}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-500 touch-manipulation"
                      >
                        Abrir github.com/login/device <ExternalLink className="h-5 w-5" />
                      </a>
                      <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando autorização... (não feche)
                      </p>
                      <button onClick={() => { setCode(null); setPhase("idle"); }} className="w-full text-center text-xs text-slate-500 hover:text-slate-300">
                        Cancelar
                      </button>
                    </div>
                  )
                )}
              </div>
            )}

            {error && <p className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-center text-sm text-rose-300">{error}</p>}
          </>
        )}

        <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
          {onOpenSettings ? (
            <button onClick={onOpenSettings} className="flex items-center gap-1 hover:text-slate-300">
              <Settings className="h-3.5 w-3.5" /> Configurações
            </button>
          ) : (
            <span />
          )}
          <span>Token só na memória da aba</span>
        </div>
      </div>
    </div>
  );
}

function ManualCfg({ onSave }: { onSave: (c: DeviceCfg) => void }) {
  const [id, setId] = useState("");
  const [relay, setRelay] = useState("");
  return (
    <div className="space-y-2 rounded-2xl border border-surface-600 bg-surface-900/60 p-3">
      <input className="w-full rounded-xl border border-surface-600 bg-surface-800 px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-sky-500" placeholder="Client ID do OAuth App" value={id} onChange={(e) => setId(e.target.value)} />
      <input className="w-full rounded-xl border border-surface-600 bg-surface-800 px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-sky-500" placeholder="URL do relay (Cloudflare Worker)" value={relay} onChange={(e) => setRelay(e.target.value)} />
      <button
        onClick={() => {
          const c: DeviceCfg = { clientId: id.trim(), relay: relay.trim().replace(/\/$/, "") };
          if (c.clientId && c.relay) onSave(c);
        }}
        className="w-full min-h-11 rounded-xl bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        disabled={!id.trim() || !relay.trim()}
      >
        Salvar e entrar (OAuth)
      </button>
    </div>
  );
}