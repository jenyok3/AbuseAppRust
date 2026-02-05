import { Minus, Square, X } from "lucide-react";

export function WindowControls() {
  const minimizeWindow = () => {
    if (window.electronAPI && window.electronAPI.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    }
  };

  const maximizeWindow = () => {
    if (window.electronAPI && window.electronAPI.maximizeWindow) {
      window.electronAPI.maximizeWindow();
    }
  };

  const closeWindow = () => {
    if (window.electronAPI && window.electronAPI.closeWindow) {
      window.electronAPI.closeWindow();
    }
  };

  return (
    <div className="fixed top-1 right-4 flex gap-1 z-[999999] pointer-events-auto">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          minimizeWindow();
        }}
        className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-white/10 bg-black"
        title="Minimize"
        style={{ zIndex: 999999 }}
      >
        <Minus className="w-2.5 h-2.5 text-white/70 hover:text-white/90 transition-colors" />
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          maximizeWindow();
        }}
        className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-white/10 bg-black"
        title="Maximize"
        style={{ zIndex: 999999 }}
      >
        <Square className="w-2.5 h-2.5 text-white/70 hover:text-white/90 transition-colors" />
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeWindow();
        }}
        className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-white/10 bg-black"
        title="Close"
        style={{ zIndex: 999999 }}
      >
        <X className="w-2.5 h-2.5 text-white/70 hover:text-white/90 transition-colors" />
      </button>
    </div>
  );
}
