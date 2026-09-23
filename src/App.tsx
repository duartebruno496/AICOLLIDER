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
import { SettingsModal } from "./components/SettingsModal";
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
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    void getFS();
    void purgeStaleServiceWorkers();
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
      <>
        <LoginScreen onOpenSettings={() => setShowSettings(true)} />
        <SettingsModal />
      </>
    ) : (
      <LandingPage onEnter={() => setStarted(true)} />
    );
  }

  return (
    <>
      <ProfileSync />
      {activeRepo ? <Workspace repo={activeRepo} /> : <ProjectWizard />}
      <SettingsModal />
    </>
  );
}