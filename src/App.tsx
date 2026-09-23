import { useEffect, useState } from "react";
import { useAppStore } from "./store/useAppStore";
import { initAuth } from "./lib/auth";
import { clientConfig } from "./lib/supabase";
import { getFS } from "./lib/fs";
import "./lib/refresher";
import "./lib/monacoSetup";
import { LandingPage } from "./components/LandingPage";
import { LoginScreen } from "./components/LoginScreen";
import { ProjectWizard } from "./components/ProjectWizard";
import { Workspace } from "./components/Workspace";
import { Dashboard } from "./components/Dashboard";
import { ProfileSync } from "./components/ProfileSync";

/** Limpa service workers antigos (causa comum de tela em branco no dev). */
async function purgeStaleServiceWorkers() {
  if ("serviceWorker" in navigator && import.meta.env.DEV) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
  }
}

export default function App() {
  const supabaseConfig = useAppStore((s) => s.supabaseConfig);
  const gitToken = useAppStore((s) => s.gitToken);
  const activeRepo = useAppStore((s) => s.activeRepo);
  const showDashboard = useAppStore((s) => s.showDashboard);
  const setShowDashboard = useAppStore((s) => s.setShowDashboard);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    void getFS();
    void purgeStaleServiceWorkers();
    // Sessão persistente: se já logou antes, volta direto pro editor.
    try {
      const raw = localStorage.getItem("aicollider:session");
      if (raw && !useAppStore.getState().gitToken) {
        const saved = JSON.parse(raw) as { token?: string; name?: string | null; avatar?: string | null; source?: string | null };
        if (saved.token) useAppStore.getState().setGitToken(saved.token, saved.name ?? null, saved.avatar ?? null, saved.source as never);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const cfg = supabaseConfig.url && supabaseConfig.anonKey ? supabaseConfig : { url: clientConfig.url, anonKey: clientConfig.anonKey };
    const hasCfg = !!(cfg.url && cfg.anonKey);
    if (!hasCfg) return;
    return initAuth(cfg);
  }, [supabaseConfig]);

  // Login obrigatório: sem GitHub, nada além da Landing/Login.
  if (!gitToken) {
    return started ? (
      showDashboard ? (
        <Dashboard />
      ) : (
        <LoginScreen onOpenSettings={() => setShowDashboard(true)} />
      )
    ) : (
      <LandingPage onEnter={() => setStarted(true)} />
    );
  }

  return (
    <>
      <ProfileSync />
      {showDashboard ? <Dashboard /> : activeRepo ? <Workspace repo={activeRepo} /> : <ProjectWizard />}
    </>
  );
}