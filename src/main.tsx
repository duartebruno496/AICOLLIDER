import "./lib/polyfills";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAppStore } from "./store/useAppStore";
import "./index.css";

if (
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  (location.protocol === "http:" || location.protocol === "https:")
) {
  registerSW({ immediate: true });
}

try {
  const saved = sessionStorage.getItem("aicollider:git");
  if (saved) {
    const p = JSON.parse(saved) as { token?: string; name?: string | null; avatar?: string | null; source?: string | null };
    if (p.token) {
      useAppStore.setState({
        gitToken: p.token,
        gitUsername: p.name ?? null,
        userAvatar: p.avatar ?? null,
        authSource: (p.source as "supabase" | "device" | "manual" | null) ?? null,
      });
    }
  }
} catch {
  /* ignore */
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);