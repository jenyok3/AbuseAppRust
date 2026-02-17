import { WindowControls } from "@/components/WindowControls";
import { useEffect } from "react";

export function GlobalWindowControls() {

  useEffect(() => {
    // Add window dragging capability
    const style = document.createElement('style');
    style.textContent = `
      .app-draggable {
        -webkit-app-region: drag;
        cursor: move;
      }
      .app-no-drag {
        -webkit-app-region: no-drag;
        cursor: default;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <>
      {/* Window Controls - on all pages */}
      <WindowControls />
    </>
  );
}
