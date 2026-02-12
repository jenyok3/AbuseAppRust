export interface TauriAPI {
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
}

declare global {
  interface Window {
    __TAURI__?: any;
    tauriAPI?: TauriAPI;
  }
}
