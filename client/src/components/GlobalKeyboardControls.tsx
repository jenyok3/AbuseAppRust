import { useEffect } from "react";
import { useLocation } from "wouter";

export function GlobalKeyboardControls() {
  const [location] = useLocation();

  useEffect(() => {
    // Only handle F6 on Telegram page
    if (location !== '/') return;

    const dispatchF6 = () => {
      console.log('F6 pressed globally');
      window.dispatchEvent(new CustomEvent('f6-pressed', {
        bubbles: true,
        cancelable: true
      }));
    };

    let cleanupGlobalShortcut: (() => void) | null = null;

    const attachLocalListener = () => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'F6' || (event.key === '6' && event.shiftKey)) {
          event.preventDefault();
          event.stopPropagation();
          dispatchF6();
        }
      };
      document.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('keydown', handleKeyDown, true);
      const cleanupLocal = () => {
        document.removeEventListener('keydown', handleKeyDown, true);
        window.removeEventListener('keydown', handleKeyDown, true);
      };
      return cleanupLocal;
    };

    const registerGlobalShortcut = async () => {
      let cleanupLocal: (() => void) | null = null;
      try {
        const mod = await import('@tauri-apps/plugin-global-shortcut');
        cleanupLocal = attachLocalListener();
        await mod.register('F6', dispatchF6);
        cleanupGlobalShortcut = () => {
          mod.unregister('F6').catch(() => {});
          if (cleanupLocal) {
            cleanupLocal();
          }
        };
      } catch (error) {
        console.warn('Global shortcut unavailable, using local listener.', error);
        cleanupLocal = attachLocalListener();
        cleanupGlobalShortcut = () => {
          if (cleanupLocal) {
            cleanupLocal();
          }
        };
      }
    };

    registerGlobalShortcut();

    // Keep window focused when possible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Window became visible');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (cleanupGlobalShortcut) {
        cleanupGlobalShortcut();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location]);

  return null;
}
