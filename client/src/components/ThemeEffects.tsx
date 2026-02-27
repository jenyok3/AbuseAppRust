"use client";

import { useEffect, useRef, useState } from "react";
import { localStore } from "@/lib/localStore";

type ThemeEffect = "none" | "sakura" | "rain" | "leaves" | "snow";

const THEME_Z_INDEX = 5;

export function ThemeEffects() {
  const [effect, setEffect] = useState<ThemeEffect>("none");
  const effectRef = useRef<ThemeEffect>("none");
  const snowSpeedRef = useRef(1);
  const sakuraIntensityRef = useRef(1);
  const rainIntensityRef = useRef(1);
  const leavesIntensityRef = useRef(1);
  const presetRef = useRef<EffectPreset | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const settings = localStore.getSettings();
    const nextEffect = normalizeThemeEffect(settings.themeEffect);
    effectRef.current = nextEffect;
    setEffect(nextEffect);
    snowSpeedRef.current = typeof settings.themeSnowSpeed === "number" ? settings.themeSnowSpeed : 1;
    sakuraIntensityRef.current = typeof settings.themeSakuraIntensity === "number" ? settings.themeSakuraIntensity : 1;
    rainIntensityRef.current = typeof settings.themeRainIntensity === "number" ? settings.themeRainIntensity : 1;
    leavesIntensityRef.current = typeof settings.themeLeavesIntensity === "number" ? settings.themeLeavesIntensity : 1;
    presetRef.current = getPreset(nextEffect, {
      snowSpeed: snowSpeedRef.current,
      sakuraIntensity: sakuraIntensityRef.current,
      rainIntensity: rainIntensityRef.current,
      leavesIntensity: leavesIntensityRef.current,
    });

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.themeEffect) {
        const next = normalizeThemeEffect(detail.themeEffect);
        effectRef.current = next;
        setEffect(next);
      }
      if (typeof detail?.themeSnowSpeed === "number") {
        snowSpeedRef.current = detail.themeSnowSpeed;
      } else {
        const next = localStore.getSettings();
        snowSpeedRef.current = typeof next.themeSnowSpeed === "number" ? next.themeSnowSpeed : 1;
      }
      if (typeof detail?.themeSakuraIntensity === "number") {
        sakuraIntensityRef.current = detail.themeSakuraIntensity;
      } else {
        const next = localStore.getSettings();
        sakuraIntensityRef.current = typeof next.themeSakuraIntensity === "number" ? next.themeSakuraIntensity : 1;
      }
      if (typeof detail?.themeRainIntensity === "number") {
        rainIntensityRef.current = detail.themeRainIntensity;
      } else {
        const next = localStore.getSettings();
        rainIntensityRef.current = typeof next.themeRainIntensity === "number" ? next.themeRainIntensity : 1;
      }
      if (typeof detail?.themeLeavesIntensity === "number") {
        leavesIntensityRef.current = detail.themeLeavesIntensity;
      } else {
        const next = localStore.getSettings();
        leavesIntensityRef.current = typeof next.themeLeavesIntensity === "number" ? next.themeLeavesIntensity : 1;
      }
      if (!detail?.themeEffect) {
        const nextEffect = normalizeThemeEffect(localStore.getSettings().themeEffect);
        effectRef.current = nextEffect;
        setEffect(nextEffect);
      }

      const currentEffect = effectRef.current;
      presetRef.current = getPreset(currentEffect, {
        snowSpeed: snowSpeedRef.current,
        sakuraIntensity: sakuraIntensityRef.current,
        rainIntensity: rainIntensityRef.current,
        leavesIntensity: leavesIntensityRef.current,
      });
    };

    window.addEventListener("settingsUpdated", handler as EventListener);
    return () => window.removeEventListener("settingsUpdated", handler as EventListener);
  }, []);

  useEffect(() => {
    if (effect === "none") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number | null = null;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let flakes: Flake[] = [];

    const preset = getPreset(effect, {
      snowSpeed: snowSpeedRef.current,
      sakuraIntensity: sakuraIntensityRef.current,
      rainIntensity: rainIntensityRef.current,
      leavesIntensity: leavesIntensityRef.current,
    });
    presetRef.current = preset;
    const season = preset.season;
    const rgbCache = new Map<string, string>();

    const seasonConfigs = {
      spring: { color: "#ffb7c5", swing: 2, speed: 0.8, size: 4 },
      summer: { color: "#7dd3fc", swing: 0, speed: 1.2, size: 1 },
      autumn: { color: "#ff8c00", swing: 1.5, speed: 1.2, size: 6 },
      winter: { color: "#e2e8f0", swing: 1, speed: 1.5, size: 2 },
    } as const;

    const updateCanvasSize = () => {
      const oldWidth = canvasWidth;
      const oldHeight = canvasHeight;
      canvasWidth = window.innerWidth;
      canvasHeight = window.innerHeight;
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        if (oldWidth && oldHeight) {
          const scaleX = canvasWidth / oldWidth;
          const scaleY = canvasHeight / oldHeight;
          flakes.forEach((flake) => {
            flake.x *= scaleX;
            flake.y *= scaleY;
          });
        }
      }
    };

    const getRgbCached = (value: string) => {
      const cached = rgbCache.get(value);
      if (cached) return cached;
      const next = getRgb(value);
      rgbCache.set(value, next);
      return next;
    };

    const createFlake = (isInitial = false): Flake => {
      const config = seasonConfigs[season] ?? seasonConfigs.winter;
      const baseSize = (preset.size ?? config.size) * 0.8;
      const radius = random(baseSize * 0.3, baseSize * 2) / 2;
      const x = getSpawnX(season, canvasWidth);
      const y = isInitial ? random(0, canvasHeight) : -radius * 4;

      if (season === "winter") {
        const velY = random(preset.speed, preset.speed * 1.5) * Math.pow(radius / baseSize, 1.5);
        return {
          x,
          y,
          r: radius,
          velY,
          velX: preset.wind,
          stepSize: random(0.01, 0.04),
          step: random(0, Math.PI * 2),
          opacity: random(0.4, preset.opacity) * (radius / baseSize + 0.2),
          rotation: random(0, 360),
          rotationSpeed: random(-0.5, 0.5),
          velFactor: preset.speed > 0 ? velY / preset.speed : 0,
        };
      }

      if (season === "summer") {
        const summerRadius = random(baseSize * 0.2, baseSize * 1.4) / 2;
        const speedFactor = random(3.2, 5.2);
        const rainLength = random(10, 24);
        const rainWidth = random(0.6, 1.2);
        const velY = preset.speed * speedFactor;
        return {
          x,
          y: isInitial ? y : -summerRadius * 4,
          r: summerRadius,
          velY,
          velX: 0,
          stepSize: random(0.005, 0.02),
          step: random(0, Math.PI * 2),
          opacity: random(0.5, preset.opacity),
          swingAmplitude: 0,
          rainLength,
          rainWidth,
          velFactor: preset.speed > 0 ? velY / preset.speed : speedFactor,
        };
      }

      if (season === "autumn") {
        const baseSpeed = preset.speed;
        const autumnRadius = random(baseSize * 1.5, baseSize * 3) / 2;
        const autumnY = isInitial ? y : -autumnRadius * 4;
        const velY = baseSpeed * random(0.8, 1.2);
        const swingAmplitude = (config.swing ?? preset.swing) * random(1.0, 1.8);
        const opacity = Math.random() < 0.5 ? 0 : random(0.5, preset.opacity);
        return {
          x,
          y: autumnY,
          r: autumnRadius,
          velY,
          velX: preset.wind,
          stepSize: random(0.006, 0.02),
          step: random(0, Math.PI * 2),
          opacity,
          rotation: random(0, 360),
          rotationSpeed: random(-1.5, 1.5),
          flip: random(0, Math.PI * 2),
          flipSpeed: random(-0.1, 0.1),
          swingAmplitude,
          velFactor: preset.speed > 0 ? velY / preset.speed : 0,
        };
      }

      if (season === "spring") {
        const baseSpeed = preset.speed;
        const velY = baseSpeed * random(0.48, 0.58);
        const springRadius = radius * 1.25;
        const oscillation = random(0.015, 0.025);
        return {
          x,
          y,
          r: springRadius,
          velY,
          velX: preset.wind,
          stepSize: oscillation,
          step: random(0, Math.PI * 2),
          opacity: random(0.5, preset.opacity),
          rotation: random(0, 360),
          rotationSpeed: random(-0.8, 0.8),
          flip: random(0, Math.PI * 2),
          flipSpeed: random(-0.12, 0.12),
          chaos: random(0.9, 1.1),
          velFactor: preset.speed > 0 ? velY / preset.speed : 0,
        };
      }

      const velY = random(preset.speed, preset.speed * 1.5) * Math.pow(radius / baseSize, 1.5);
      return {
        x,
        y,
        r: radius,
        velY,
        velX: preset.wind,
        stepSize: random(0.01, 0.04),
        step: random(0, Math.PI * 2),
        opacity: random(0.4, preset.opacity) * (radius / baseSize + 0.2),
        rotation: random(0, 360),
        rotationSpeed: random(-0.5, 0.5),
        velFactor: preset.speed > 0 ? velY / preset.speed : 0,
      };
    };

    const drawShape = (flake: Flake) => {
      const theme = preset.theme;
      ctx.save();

      if (season === "summer") {
        const dropLen = Math.max(10, (flake.rainLength ?? 14) + flake.velY * 0.4);
        const alpha = (theme === "dark" ? 0.25 : 0.65) * flake.opacity;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.strokeStyle =
          theme === "light"
            ? `rgba(147, 197, 253, ${Math.min(1, flake.opacity * 1.1)})`
            : `rgba(255, 255, 255, ${Math.min(1, flake.opacity * 0.85)})`;
        ctx.lineWidth = flake.rainWidth ?? Math.max(0.6, 0.35 + flake.r * 0.25);
        ctx.beginPath();
        ctx.moveTo(flake.x, flake.y);
        ctx.lineTo(flake.x, flake.y + dropLen);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
        return;
      }

      if (season === "spring") {
        const pinkAlpha = theme === "light" ? Math.min(1, flake.opacity * 1.12) : Math.min(1, flake.opacity * 0.5);
        ctx.globalAlpha = theme === "light" ? 0.96 : 0.82;
        ctx.fillStyle = `rgba(255, 192, 203, ${pinkAlpha})`;
        ctx.translate(flake.x, flake.y);
        ctx.rotate((flake.rotation ?? 0) * (Math.PI / 180));
        ctx.scale(Math.abs(Math.cos(flake.flip ?? 0)) * 0.3 + 0.7, 1);
        const pr = flake.r * 1.1;
        const wr = flake.r * 0.9;
        ctx.beginPath();
        ctx.moveTo(0, -pr);
        ctx.bezierCurveTo(-wr, -pr * 0.3, -wr * 0.8, pr * 0.8, 0, pr);
        ctx.bezierCurveTo(wr * 0.8, pr * 0.8, wr, -pr * 0.3, 0, -pr);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
        return;
      }

      if (season === "autumn") {
        const baseColor =
          preset.color === "#fff" || preset.color === "#ffffff"
            ? seasonConfigs.autumn?.color || "#ff8c00"
            : preset.color;
        const opacityMult = theme === "dark" ? 0.5 : 1;
        ctx.fillStyle = `rgba(${getRgbCached(baseColor)}, ${Math.min(1, flake.opacity * opacityMult)})`;
        ctx.translate(flake.x, flake.y);
        ctx.rotate((flake.rotation ?? 0) * (Math.PI / 180));
        ctx.scale(Math.abs(Math.cos(flake.flip ?? 0)) * 0.3 + 0.7, 1);
        const L = flake.r * 1.35;
        ctx.beginPath();
        ctx.moveTo(0, L);
        ctx.quadraticCurveTo(L * 0.12, L * 0.6, L * 0.4, L * 0.7);
        ctx.quadraticCurveTo(L * 0.3, L * 0.25, L * 0.65, L * 0.05);
        ctx.quadraticCurveTo(L * 0.45, -L * 0.2, L * 0.5, -L * 0.7);
        ctx.quadraticCurveTo(L * 0.2, -L * 0.5, 0, -L * 0.55);
        ctx.quadraticCurveTo(-L * 0.2, -L * 0.5, -L * 0.5, -L * 0.7);
        ctx.quadraticCurveTo(-L * 0.45, -L * 0.2, -L * 0.65, L * 0.05);
        ctx.quadraticCurveTo(-L * 0.3, L * 0.25, -L * 0.4, L * 0.7);
        ctx.quadraticCurveTo(-L * 0.12, L * 0.6, 0, L);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
      }

      const baseColor = theme === "light" ? "#dbeafe" : "#e2e8f0";
      const snowAlpha = theme === "light" ? Math.min(1, flake.opacity * 1.12) : flake.opacity * 0.5;
      if (theme === "light") ctx.globalAlpha = 0.96;
      ctx.fillStyle = `rgba(${getRgbCached(baseColor)}, ${snowAlpha})`;
      ctx.shadowBlur = 2;
      ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (theme === "light") ctx.globalAlpha = 1;
      ctx.restore();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      const currentPreset = presetRef.current ?? preset;
      const windBase = currentPreset.wind * 0.5;
      const isSummer = season === "summer";
      const bottomMargin = isSummer ? 100 : 0;

      const oscillationScale = getOscillationScale(season, currentPreset.speed);

      for (let i = 0; i < flakes.length; i += 1) {
        const flake = flakes[i];
        if (flake.velFactor != null) {
          flake.velY = flake.velFactor * currentPreset.speed;
        }
        flake.y += flake.velY;

        const windX = flake.velX ?? windBase;

        if (season === "spring") {
          flake.step += flake.stepSize * oscillationScale;
          flake.x += Math.sin(flake.step) * 0.35 * (flake.chaos ?? 1) + windX;
        } else if (season === "autumn") {
          flake.step += flake.stepSize;
          const swing = flake.swingAmplitude ?? preset.swing;
          flake.x += Math.sin(flake.step) * (swing * 0.2);
        } else {
          flake.step += flake.stepSize * (season === "winter" ? oscillationScale : 1);
          const swing = flake.swingAmplitude ?? preset.swing;
          flake.x += Math.sin(flake.step) * (swing * 0.5) + windX;
        }

        if (season === "spring" || season === "autumn") {
          flake.flip = (flake.flip ?? 0) + (flake.flipSpeed ?? 0);
          flake.rotation = (flake.rotation ?? 0) + (flake.rotationSpeed ?? 0);
        }

        if (!(season === "autumn" && flake.opacity === 0)) {
          drawShape(flake);
        }

        const margin = bottomMargin || flake.r;
        if (flake.y > canvasHeight + margin || flake.x > canvasWidth + flake.r || flake.x < -flake.r) {
          flakes[i] = createFlake(false);
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    const init = () => {
      updateCanvasSize();
      canvas.style.zIndex = preset.zIndex ? String(preset.zIndex) : "auto";
      const baseArea = 1920 * 1080;
      const currentArea = canvasWidth * canvasHeight;
      const ratio = Math.sqrt(currentArea / baseArea);
      const finalAmount = Math.max(80, Math.min(600, Math.floor(preset.amount * ratio)));
      flakes = Array.from({ length: finalAmount }, () => createFlake(true));
      animationId = requestAnimationFrame(animate);
    };

    init();
    window.addEventListener("resize", updateCanvasSize);

    return () => {
      if (animationId != null) {
        cancelAnimationFrame(animationId);
      }
      window.removeEventListener("resize", updateCanvasSize);
    };
  }, [effect]);

  if (effect === "none") return null;

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: THEME_Z_INDEX, mixBlendMode: "screen", opacity: 0.9 }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

type SeasonName = "spring" | "summer" | "autumn" | "winter";

type EffectPreset = {
  season: SeasonName;
  amount: number;
  size: number;
  speed: number;
  wind: number;
  color: string;
  opacity: number;
  swing: number;
  theme: "light" | "dark";
  zIndex?: number;
};

type Flake = {
  x: number;
  y: number;
  r: number;
  velY: number;
  velX?: number;
  stepSize: number;
  step: number;
  opacity: number;
  rotation?: number;
  rotationSpeed?: number;
  flip?: number;
  flipSpeed?: number;
  swingAmplitude?: number;
  chaos?: number;
  rainLength?: number;
  rainWidth?: number;
  velFactor?: number;
};

type EffectTuning = {
  snowSpeed: number;
  sakuraIntensity: number;
  rainIntensity: number;
  leavesIntensity: number;
};

function getPreset(effect: ThemeEffect, tuning: EffectTuning): EffectPreset {
  switch (effect) {
    case "sakura":
      return {
        season: "spring",
        amount: 140,
        size: 5,
        speed: 1.2 * tuning.sakuraIntensity,
        wind: 0,
        color: "#ffb7c5",
        opacity: 0.85,
        swing: 1.2,
        theme: "light",
      };
    case "rain":
      return {
        season: "summer",
        amount: 300,
        size: 1.6,
        speed: 0.9 * tuning.rainIntensity,
        wind: 0,
        color: "#7dd3fc",
        opacity: 0.7,
        swing: 0,
        theme: "light",
      };
    case "leaves":
      return {
        season: "autumn",
        amount: 120,
        size: 6,
        speed: 1.2 * tuning.leavesIntensity,
        wind: 0,
        color: "#ff8c00",
        opacity: 0.85,
        swing: 1.4,
        theme: "light",
      };
    case "snow":
      return {
        season: "winter",
        amount: 170,
        size: 3,
        speed: Math.max(0.3, tuning.snowSpeed),
        wind: 0.1,
        color: "#ffffff",
        opacity: 0.9,
        swing: 1,
        theme: "light",
      };
    default:
      return {
        season: "winter",
        amount: 120,
        size: 3,
        speed: 1,
        wind: 0.1,
        color: "#ffffff",
        opacity: 0.8,
        swing: 1,
        theme: "light",
      };
  }
}

function normalizeThemeEffect(value?: string): ThemeEffect {
  switch (value) {
    case "winter":
      return "snow";
    case "spring":
      return "sakura";
    case "summer":
      return "rain";
    case "autumn":
      return "leaves";
    case "sakura":
    case "rain":
    case "leaves":
    case "snow":
      return value;
    default:
      return "none";
  }
}

function getSpawnX(season: SeasonName, width: number) {
  if (season === "autumn") {
    const roll = Math.random();
    if (roll < 0.35) {
      return random(width * 0.25, width * 0.75);
    }
    if (roll < 0.675) {
      return random(-width * 0.15, width * 0.25);
    }
    return random(width * 0.75, width * 1.15);
  }
  return random(0, width);
}

function getOscillationScale(season: SeasonName, speed: number) {
  if (season === "spring") {
    return clamp(speed / 1.2, 0.3, 1.3);
  }
  if (season === "winter") {
    return clamp(speed / 1.0, 0.3, 1.3);
  }
  return 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function getRgb(value: string) {
  if (value.indexOf("#") === 0) {
    if (value.length === 4) {
      return value
        .slice(1)
        .split("")
        .map((n) => parseInt(n + n, 16))
        .join(",");
    }
    if (value.length === 7) {
      return [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)]
        .map((n) => parseInt(n, 16))
        .join(",");
    }
    return "255,255,255";
  }
  if (value.indexOf("rgb(") === 0) return value.slice(4, -1);
  return "255,255,255";
}
