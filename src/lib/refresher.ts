import { refreshStorageInfo } from "./workspace";
import { useAppStore } from "../store/useAppStore";

let started = false;

/** Monitor de armazenamento (regra de negócio #4): verifica o limite de 5GB periodicamente. */
export function startStorageRefresher() {
  if (started) return;
  started = true;
  const tick = async () => {
    const info = await refreshStorageInfo(false);
    useAppStore.getState().setStorage(info);
    if (info.overWarning) {
      useAppStore.getState().setToast?.(
        info.overLimit
          ? "Armazenamento do navegador no limite (5GB). Exclua repositórios locais antigos."
          : "Uso de armazenamento acima de 4.5GB. Considere excluir caches antigos."
      );
      setTimeout(() => useAppStore.getState().setToast?.(null), 6000);
    }
  };
  void tick();
  setInterval(() => void tick(), 15000);
}

startStorageRefresher();