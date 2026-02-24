"use client";

import { useEffect, useMemo, useState } from "react";
import { localStore } from "@/lib/localStore";

type ThemeEffect = "none" | "winter" | "autumn" | "spring" | "summer";

export function ThemeEffects() {
  const [effect, setEffect] = useState<ThemeEffect>("none");
  const [snowSpeed, setSnowSpeed] = useState(1);

  useEffect(() => {
    const settings = localStore.getSettings();
    setEffect(settings.themeEffect || "none");
    setSnowSpeed(typeof settings.themeSnowSpeed === "number" ? settings.themeSnowSpeed : 1);

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.themeEffect) {
        setEffect(detail.themeEffect as ThemeEffect);
      }
      if (typeof detail?.themeSnowSpeed === "number") {
        setSnowSpeed(detail.themeSnowSpeed);
      } else {
        const next = localStore.getSettings();
        setSnowSpeed(typeof next.themeSnowSpeed === "number" ? next.themeSnowSpeed : 1);
      }
      if (!detail?.themeEffect) {
        setEffect(localStore.getSettings().themeEffect || "none");
      }
    };

    window.addEventListener("settingsUpdated", handler as EventListener);
    return () => window.removeEventListener("settingsUpdated", handler as EventListener);
  }, []);

  if (effect === "winter") return <Snowfall speed={snowSpeed} />;
  return null;
}

function Snowfall({ speed }: { speed: number }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const size = 2 + Math.random() * 3;
        const left = Math.random() * 100;
        const duration = 6 + Math.random() * 8;
        const delay = Math.random() * -10;
        const opacity = 0.35 + Math.random() * 0.5;
        const drift = (Math.random() * 20 - 10).toFixed(1);
        return { id: i, size, left, duration, delay, opacity, drift };
      }),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      <style>{`
@keyframes snow-fall {
  0% { transform: translate3d(var(--drift), -10vh, 0); }
  100% { transform: translate3d(calc(var(--drift) * -1), 110vh, 0); }
}
`}</style>
      {flakes.map((flake) => (
        <span
          key={flake.id}
          style={{
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDuration: `${Math.max(2, flake.duration / Math.max(0.5, speed))}s`,
            animationDelay: `${flake.delay}s`,
            ["--drift" as any]: `${flake.drift}vw`,
          }}
          className="absolute top-0 rounded-full bg-white/80 blur-[0.2px] animate-[snow-fall_linear_infinite]"
        />
      ))}
    </div>
  );
}
