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
    <div className="absolute inset-y-0 right-1 flex items-center gap-1 z-50 pointer-events-auto app-no-drag">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          minimizeWindow();
        }}
        className="w-5 h-5 flex items-center justify-center rounded-sm"
        title="Minimize"
      >
        <Minus strokeWidth={2.5} className="w-3 h-3 text-white/95 hover:text-white transition-colors" />
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          maximizeWindow();
        }}
        className="w-5 h-5 flex items-center justify-center rounded-sm"
        title="Maximize"
      >
        <Square strokeWidth={2.5} className="w-3 h-3 text-white hover:text-white transition-colors" />
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeWindow();
        }}
        className="w-5 h-5 flex items-center justify-center rounded-sm"
        title="Close"
      >
        <X strokeWidth={2.5} className="w-3 h-3 text-white/95 hover:text-white transition-colors" />
      </button>
    </div>
  );
}
