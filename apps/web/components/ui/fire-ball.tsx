"use client";

import type React from "react";
import { useEffect, useId, useRef } from "react";

type FireBallProps = {
  colors?: string[];
  background?: string;
  blur?: number;
  blobRadius?: number;
  particleRadiusRange?: [number, number];
  useXorComposite?: boolean;
  ballColor?: string;
  particleCount?: number;
  followStrength?: number;
  fullScreen?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

type Particle = {
  x: number;
  y: number;
  r: number;
  color: string;
  vx: number;
  vy: number;
  life: number;
};

export function FireBall({
  colors = ["#22d3ee", "#fb923c", "#38bdf8"],
  background = "transparent",
  blur = 3,
  blobRadius = 7,
  ballColor = "#38bdf8",
  particleRadiusRange = [2, 4],
  useXorComposite = false,
  particleCount = 24,
  followStrength = 0.18,
  fullScreen = true,
  className,
  style,
}: FireBallProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const accelRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ width: 0, height: 0 });

  const filterId = useId().replace(/:/g, "-");
  const filterUrl = `url(#goo-${filterId})`;

  const randInt = (min: number, max: number) =>
    Math.round(Math.random() * (max - min) + min);

  const resetParticle = (p: Particle) => {
    const [minR, maxR] = particleRadiusRange;
    p.x = posRef.current.x;
    p.y = posRef.current.y;
    p.r = randInt(minR, maxR);
    p.color = colors[Math.floor(Math.random() * colors.length)];
    p.vx = randInt(-2, 2);
    p.vy = randInt(5, 10);
    p.life = randInt(16, 26);
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const parent = canvas.parentElement;
    const rect = fullScreen
      ? { width: window.innerWidth, height: window.innerHeight }
      : parent
        ? parent.getBoundingClientRect()
        : { width: 800, height: 600 };

    sizeRef.current = { width: rect.width, height: rect.height };
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    resizeCanvas();

    posRef.current = { x: sizeRef.current.width / 2, y: sizeRef.current.height / 2 };
    accelRef.current = { ...posRef.current };

    particlesRef.current = Array.from({ length: particleCount }, (): Particle => ({
      x: posRef.current.x,
      y: posRef.current.y,
      r: randInt(particleRadiusRange[0], particleRadiusRange[1]),
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: randInt(-2, 2),
      vy: randInt(5, 10),
      life: randInt(16, 26),
    }));

    function onPointerMove(event: PointerEvent) {
      const activeCanvas = canvasRef.current;
      if (!activeCanvas) {
        return;
      }
      const rect = activeCanvas.getBoundingClientRect();
      const x = fullScreen ? event.clientX : event.clientX - rect.left;
      const y = fullScreen ? event.clientY : event.clientY - rect.top;
      posRef.current.x = x;
      posRef.current.y = y;
    }

    function onResize() {
      resizeCanvas();
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize);

    const render = () => {
      const { width, height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);

      accelRef.current.x += (posRef.current.x - accelRef.current.x) * followStrength;
      accelRef.current.y += (posRef.current.y - accelRef.current.y) * followStrength;

      ctx.save();
      if (useXorComposite) {
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.beginPath();
      ctx.fillStyle = ballColor;
      ctx.arc(accelRef.current.x, accelRef.current.y, blobRadius, 0, Math.PI * 2);
      ctx.fill();

      if (useXorComposite) {
        ctx.globalCompositeOperation = "xor";
      }

      for (const particle of particlesRef.current) {
        ctx.beginPath();
        ctx.fillStyle = particle.color;
        ctx.arc(particle.x, particle.y, Math.max(0, particle.r), 0, Math.PI * 2);
        ctx.fill();

        particle.x += particle.vx;
        particle.y -= particle.vy;
        particle.r -= 0.08;
        particle.life -= 1;

        if (particle.life < 0 || particle.r < 0) {
          resetParticle(particle);
        }
      }

      ctx.restore();
      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
    };
  }, [
    ballColor,
    blobRadius,
    colors,
    followStrength,
    fullScreen,
    particleCount,
    particleRadiusRange,
    useXorComposite,
  ]);

  return (
    <div
      className={className}
      style={{
        position: fullScreen ? "fixed" : "relative",
        inset: fullScreen ? 0 : undefined,
        width: fullScreen ? "100vw" : "100%",
        height: fullScreen ? "100vh" : "100%",
        overflow: "hidden",
        background,
        ...style,
      }}
    >
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        focusable="false"
        style={{ position: "absolute" }}
      >
        <filter id={`goo-${filterId}`}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 60 -9"
          />
        </filter>
      </svg>

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          filter: filterUrl as never,
          WebkitFilter: filterUrl as never,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
