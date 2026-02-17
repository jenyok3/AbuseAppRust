import { invoke } from '@tauri-apps/api/core';
import { Minus, Square, X } from "lucide-react";

export function WindowControls() {
  const minimizeWindow = async () => {
    try {
      await invoke('minimize_window');
    } catch (error) {
      console.error('Failed to minimize window:', error);
    }
  };

  const maximizeWindow = async () => {
    try {
      await invoke('maximize_window');
    } catch (error) {
      console.error('Failed to maximize window:', error);
    }
  };

  const closeWindow = async () => {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('Failed to close window:', error);
    }
  };

  return (
    <div className="absolute top-1/2 right-1 -translate-y-1/2 flex gap-1 z-50 pointer-events-auto app-no-drag">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          minimizeWindow();
        }}
        className="w-5 h-5 flex items-center justify-center rounded"
        title="Minimize"
      >
        <Minus className="w-2.5 h-2.5 text-white/70 hover:text-white/90 transition-colors" />
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          maximizeWindow();
        }}
        className="w-5 h-5 flex items-center justify-center rounded"
        title="Maximize"
      >
        <Square className="w-2.5 h-2.5 text-white/70 hover:text-white/90 transition-colors" />
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeWindow();
        }}
        className="w-5 h-5 flex items-center justify-center rounded"
        title="Close"
      >
        <X className="w-2.5 h-2.5 text-white/70 hover:text-white/90 transition-colors" />
      </button>
    </div>
  );
}
