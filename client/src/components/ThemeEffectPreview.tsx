import { useEffect, useRef } from "react";

type PreviewEffect = "snow" | "sakura" | "rain" | "leaves";
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

const PREVIEW_SPEED_FACTOR = 0.58;

const seasonConfigs = {
  spring: { color: "#ffb7c5", swing: 2, speed: 0.8, size: 4 },
  summer: { color: "#7dd3fc", swing: 0, speed: 1.2, size: 1 },
  autumn: { color: "#ff8c00", swing: 1.5, speed: 1.2, size: 6 },
  winter: { color: "#e2e8f0", swing: 1, speed: 1.5, size: 2 },
} as const;

export function ThemeEffectPreview({ effect }: { effect: PreviewEffect }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const preset = getPreset(effect);
    const season = preset.season;
    const rgbCache = new Map<string, string>();

    let animationId: number | null = null;
    let width = 0;
    let height = 0;
    let flakes: Flake[] = [];

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      if (nextWidth === width && nextHeight === height) return;
      const prevWidth = width;
      const prevHeight = height;
      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      if (prevWidth > 0 && prevHeight > 0) {
        const sx = width / prevWidth;
        const sy = height / prevHeight;
        flakes.forEach((flake) => {
          flake.x *= sx;
          flake.y *= sy;
        });
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();

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
      const x = getSpawnX(season, width);
      const y = isInitial ? random(0, height) : -radius * 4;

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
        const velY = preset.speed * random(0.8, 1.2);
        const swingAmplitude = (config.swing ?? preset.swing) * random(1.0, 1.8);
        const opacity = Math.random() < 0.5 ? 0 : random(0.5, preset.opacity);
        const autumnRadius = random(baseSize * 1.5, baseSize * 3) / 2;
        return {
          x,
          y: isInitial ? y : -autumnRadius * 4,
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

      const velY = preset.speed * random(0.48, 0.58);
      return {
        x,
        y,
        r: radius * 1.25,
        velY,
        velX: preset.wind,
        stepSize: random(0.015, 0.025),
        step: random(0, Math.PI * 2),
        opacity: random(0.5, preset.opacity),
        rotation: random(0, 360),
        rotationSpeed: random(-0.8, 0.8),
        flip: random(0, Math.PI * 2),
        flipSpeed: random(-0.12, 0.12),
        chaos: random(0.9, 1.1),
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
        ctx.strokeStyle = `rgba(147, 197, 253, ${Math.min(1, flake.opacity * 1.1)})`;
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
        const pinkAlpha = Math.min(1, flake.opacity * 1.12);
        ctx.globalAlpha = 0.96;
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
            ? seasonConfigs.autumn.color
            : preset.color;
        ctx.fillStyle = `rgba(${getRgbCached(baseColor)}, ${Math.min(1, flake.opacity)})`;
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

      ctx.globalAlpha = 0.96;
      ctx.fillStyle = `rgba(${getRgbCached("#dbeafe")}, ${Math.min(1, flake.opacity * 1.12)})`;
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      const windBase = preset.wind * 0.5;

      for (let i = 0; i < flakes.length; i += 1) {
        const flake = flakes[i];
        if (flake.velFactor != null) {
          flake.velY = flake.velFactor * preset.speed;
        }
        flake.y += flake.velY;

        if (season === "spring") {
          flake.step += flake.stepSize;
          flake.x += Math.sin(flake.step) * 0.35 * (flake.chaos ?? 1) + (flake.velX ?? windBase);
        } else if (season === "autumn") {
          flake.step += flake.stepSize;
          flake.x += Math.sin(flake.step) * ((flake.swingAmplitude ?? preset.swing) * 0.2);
        } else {
          flake.step += flake.stepSize;
          flake.x += Math.sin(flake.step) * ((flake.swingAmplitude ?? preset.swing) * 0.5) + (flake.velX ?? windBase);
        }

        if (season === "spring" || season === "autumn") {
          flake.flip = (flake.flip ?? 0) + (flake.flipSpeed ?? 0);
          flake.rotation = (flake.rotation ?? 0) + (flake.rotationSpeed ?? 0);
        }

        if (!(season === "autumn" && flake.opacity === 0)) {
          drawShape(flake);
        }

        if (flake.y > height + 80 || flake.x > width + 50 || flake.x < -50) {
          flakes[i] = createFlake(false);
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    const area = Math.max(1, width * height);
    const amount = Math.max(32, Math.min(180, Math.floor((preset.amount * area) / (1920 * 1080) * 1.6)));
    flakes = Array.from({ length: amount }, () => createFlake(true));
    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId != null) cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, [effect]);

  return <canvas ref={canvasRef} className="theme-preview-canvas" />;
}

function getPreset(effect: PreviewEffect): EffectPreset {
  switch (effect) {
    case "sakura":
      return {
        season: "spring",
        amount: 140,
        size: 5,
        speed: 1.2 * PREVIEW_SPEED_FACTOR,
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
        speed: 0.9 * PREVIEW_SPEED_FACTOR,
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
        speed: 0.8 * PREVIEW_SPEED_FACTOR,
        wind: 0,
        color: "#ff8c00",
        opacity: 0.85,
        swing: 1.4,
        theme: "light",
      };
    case "snow":
    default:
      return {
        season: "winter",
        amount: 170,
        size: 3,
        speed: 1 * PREVIEW_SPEED_FACTOR,
        wind: 0.02,
        color: "#ffffff",
        opacity: 0.9,
        swing: 0.25,
        theme: "light",
      };
  }
}

function getSpawnX(season: SeasonName, width: number) {
  if (season === "autumn") {
    const roll = Math.random();
    if (roll < 0.35) return random(width * 0.25, width * 0.75);
    if (roll < 0.675) return random(-width * 0.15, width * 0.25);
    return random(width * 0.75, width * 1.15);
  }
  return random(0, width);
}

function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function getRgb(value: string) {
  if (value.startsWith("#")) {
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
  }
  return "255,255,255";
}
