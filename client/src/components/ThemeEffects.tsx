"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
        const opacity = 0.35 + Math.random() * 0.5;
        const baseX = Math.random();
        const fallSpeed = 18 + Math.random() * 40;
        const driftAmp = 8 + Math.random() * 24;
        const driftSpeed = 0.4 + Math.random() * 0.8;
        const phase = Math.random() * Math.PI * 2;
        return { id: i, size, opacity, baseX, fallSpeed, driftAmp, driftSpeed, phase };
      }),
    []
  );
  const [positions, setPositions] = useState(() =>
    flakes.map((flake) => ({
      id: flake.id,
      x: 0,
      y: 0,
    }))
  );
  const stateRef = useRef(
    flakes.map((flake) => ({
      id: flake.id,
      y: Math.random() * 600,
      baseX: flake.baseX,
      phase: flake.phase,
    }))
  );
  const sizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      sizeRef.current = {
        width: window.innerWidth || 0,
        height: window.innerHeight || 0,
      };
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { width, height } = sizeRef.current;
      const next = stateRef.current.map((state, index) => {
        const flake = flakes[index];
        let y = state.y + flake.fallSpeed * Math.max(0.2, speed) * dt;
        let baseX = state.baseX;
        let phase = state.phase + flake.driftSpeed * dt;
        if (height > 0 && y > height + flake.size) {
          y = -flake.size - Math.random() * height * 0.2;
          baseX = Math.random();
          phase = Math.random() * Math.PI * 2;
        }
        return { ...state, y, baseX, phase };
      });
      stateRef.current = next;

      if (width > 0 && height > 0) {
        setPositions(
          next.map((state, index) => {
            const flake = flakes[index];
            const x = state.baseX * width + Math.sin(state.phase) * flake.driftAmp;
            return { id: flake.id, x, y: state.y };
          })
        );
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [flakes, speed]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {flakes.map((flake) => (
        <span
          key={flake.id}
          style={{
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            transform: `translate3d(${positions[flake.id]?.x ?? 0}px, ${positions[flake.id]?.y ?? 0}px, 0)`,
          }}
          className="snowflake absolute top-0 rounded-full bg-white/80 blur-[0.2px]"
        />
      ))}
    </div>
  );
}
