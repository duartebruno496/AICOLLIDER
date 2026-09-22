import { Bot, GitBranch, ShieldCheck, Cpu, ArrowRight, Sparkles, Zap, ServerOff, Layers } from "lucide-react";

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const cards = [
    {
      icon: Bot,
      title: "Chat com agentes",
      text: "O Orchestrator planeja a tarefa, o Coder escreve no repositório virtual e o Reviewer revisa cada mudança antes de apresentar a você.",
    },
    {
      icon: ShieldCheck,
      title: "Aprovação humana",
      text: "Nada é salvo sem o seu OK. Toda sugestão da IA abre um diff vermelho/verde e aguarda o seu clique em Aceitar ou Rejeitar.",
    },
    {
      icon: GitBranch,
      title: "Git no navegador",
      text: "Clone, commit, push e pull dos seus repositórios GitHub direto do IndexedDB, com até 5GB de espaço, mesmo offline.",
    },
    {
      icon: Cpu,
      title: "IA local ou BYOK",
      text: "Sem chave? Rode modelos pequenos no seu device com WebGPU (WebLLM). Prefere nuvem? OpenAI, Anthropic e Gemini com sua própria chave.",
    },
  ];

  const stats = [
    { icon: Zap, num: "100%", label: "client-side, sem backend" },
    { icon: ServerOff, num: "0", label: "SSH/FTP — deploy só via workflows" },
    { icon: Layers, num: "5GB", label: "de armazenamento no navegador" },
    { icon: Sparkles, num: "3", label: "agentes: Orchestrator, Coder, Reviewer" },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-200">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(52,211,153,0.12),_transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pt-24">
          <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-surface-600 bg-surface-900/70 px-4 py-1.5 text-xs text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            PWA · Serverless · 100% no navegador
          </div>
          <h1 className="text-center text-5xl font-black tracking-tight text-white sm:text-6xl">AICOLLIDER</h1>
          <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-slate-300">
            Vibe Coding direto do navegador: <span className="text-sky-300">Git</span>,{" "}
            <span className="text-emerald-300">arquivos</span> e <span className="text-amber-300">IA</span> rodando no seu
            device. Sem servidores, sem instalação, sem configuração de infra.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={onEnter}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 active:scale-[0.98] sm:w-auto touch-manipulation"
            >
              Entrar <ArrowRight className="h-5 w-5" />
            </button>
            <a
              href="#como-funciona"
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-surface-600 bg-surface-900/60 px-6 py-3.5 text-base font-medium text-slate-200 hover:bg-surface-800 sm:w-auto touch-manipulation"
            >
              Como funciona
            </a>
          </div>

          {/* mock de terminal puro CSS */}
          <div className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-2xl border border-surface-600 bg-surface-900/80 text-left shadow-2xl backdrop-blur">
            <div className="flex items-center gap-1.5 border-b border-surface-600 px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-rose-500" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="ml-3 font-mono text-xs text-slate-500">aicollider — repositório virtual</span>
            </div>
            <div className="space-y-1.5 p-5 font-mono text-[13px] leading-relaxed">
              <p className="text-slate-400">
                <span className="text-emerald-400">você</span>
                <span className="text-slate-600"> ~ </span>
                <span className="text-slate-300">"Crie um README.md explicando o projeto"</span>
              </p>
              <p className="text-sky-400">Plano: 1) listFiles 2) sugerir README.md 3) aguardar aprovação</p>
              <p className="text-slate-400">… CoderAgent propõe: <span className="text-rose-300">+ 12 linhas</span> em README.md</p>
              <p className="text-amber-300">⏸ Aguardando aprovação humana no diff…</p>
              <p className="text-emerald-400">✓ Aceito → commit criado (lightning-fs)</p>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="scroll-mt-10 border-t border-surface-800 bg-surface-900/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-3xl font-bold text-white">Feito para quem cria com IA</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-400">
            Um fluxo de engenharia completo com guardrails: a IA propõe, você aprova, o Git comita.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.title} className="group rounded-2xl border border-surface-600 bg-surface-900 p-5 transition hover:border-sky-500/60 hover:bg-surface-800">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20">
                  <c.icon className="h-5 w-5 text-sky-300" />
                </div>
                <h3 className="font-semibold text-white">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STACK / NÚMEROS */}
      <section className="border-t border-surface-800">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-4 rounded-2xl border border-surface-700 bg-surface-900/60 p-5">
                <s.icon className="h-8 w-8 shrink-0 text-emerald-400" />
                <div>
                  <div className="text-2xl font-extrabold text-white">{s.num}</div>
                  <div className="text-xs text-slate-400">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-surface-800">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-3xl font-bold text-white">Pronto para codar sem infra?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
            Suba seu projeto em segundos com login GitHub: clone um repositório privado e deixe a IA trazer a primeira
            implementação — você aprova cada mudança antes de virar commit.
          </p>
          <button
            onClick={onEnter}
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 px-10 py-3.5 text-base font-bold text-white shadow-lg shadow-sky-500/20 transition hover:brightness-110 active:scale-[0.98] touch-manipulation"
          >
            Entrar agora <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-surface-800 bg-surface-900/60 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-slate-500 sm:flex-row">
          <span>⚡ AICOLLIDER — Vibe Coding PWA · React + Vite + Tailwind + WebGPU</span>
          <span>Requer Chrome/Edge atual para o modelo local (WebGPU).</span>
        </div>
      </footer>
    </div>
  );
}