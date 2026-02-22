import { useEffect } from "react";
import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { enable, isEnabled } from "@tauri-apps/plugin-autostart";

export function AppTray() {
  useEffect(() => {
    let tray: TrayIcon | null = null;

    const setup = async () => {
      try {
        const menu = await Menu.new({
          items: [
            {
              id: "open",
              text: "Відкрити",
              action: async () => {
                await invoke("show_window");
              },
            },
            {
              id: "quit",
              text: "Вийти",
              action: async () => {
                await invoke("quit_app");
              },
            },
          ],
        });

        const icon = await defaultWindowIcon();
        tray = await TrayIcon.new({
          icon: icon ?? undefined,
          menu,
          showMenuOnLeftClick: false,
          tooltip: "AbuseApp",
          action: async (event) => {
            if (event.type === "Click") {
              await invoke("show_window");
            }
          },
        });
      } catch (error) {
        console.error("Failed to init tray:", error);
      }
    };

    const ensureAutostart = async () => {
      try {
        const enabled = await isEnabled();
        if (!enabled) {
          await enable();
        }
      } catch (error) {
        console.error("Failed to enable autostart:", error);
      }
    };

    setup();
    ensureAutostart();

    return () => {
      tray?.close();
    };
  }, []);

  return null;
}
