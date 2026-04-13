"use client";

import { useMemo, useState, type ReactNode } from "react";
import { MeshGradient, PulsingBorder } from "@paper-design/shaders-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface HeroProps {
  trustBadge?: {
    text: string;
    icons?: string[];
  };
  headline: {
    line1: string;
    line2: string;
  };
  subtitle: string;
  actionSlot?: ReactNode;
  refreshToken?: number;
  className?: string;
}

const FLOATING_PARTICLES = [
  { left: "14%", top: "22%", driftX: -10, driftY: -12, delay: 0 },
  { left: "22%", top: "18%", driftX: 8, driftY: -18, delay: 0.18 },
  { left: "18%", top: "30%", driftX: -6, driftY: -14, delay: 0.36 },
  { left: "26%", top: "26%", driftX: 12, driftY: -10, delay: 0.54 },
  { left: "11%", top: "34%", driftX: -8, driftY: -16, delay: 0.72 },
  { left: "29%", top: "16%", driftX: 10, driftY: -20, delay: 0.9 },
] as const;

export default function ShaderShowcase({
  trustBadge,
  headline,
  subtitle,
  actionSlot,
  refreshToken = 0,
  className,
}: HeroProps) {
  const [isActive, setIsActive] = useState(false);

  const ringText = useMemo(
    () => "PathwayIQ • Explore • Compare • Discover • Build • ",
    [],
  );

  return (
    <div
      className={cn("relative min-h-screen overflow-hidden bg-black", className)}
      onPointerEnter={() => setIsActive(true)}
      onPointerLeave={() => setIsActive(false)}
    >
      <svg className="absolute inset-0 h-0 w-0">
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <filter id="logo-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <MeshGradient
        key={`hero-mesh-base-${refreshToken}`}
        className="absolute inset-0 h-full w-full"
        colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
        speed={0.3}
      />
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: isActive ? 0.68 : 0.48 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <MeshGradient
          key={`hero-mesh-overlay-${refreshToken}`}
          className="absolute inset-0 h-full w-full"
          colors={["#000000", "#ffffff", "#06b6d4", "#f97316"]}
          speed={0.2}
        />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_28%,rgba(34,211,238,0.22),transparent_24%),radial-gradient(circle_at_78%_22%,rgba(249,115,22,0.16),transparent_22%),linear-gradient(180deg,rgba(0,0,0,0.05),transparent_38%,rgba(0,0,0,0.72))]" />

      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {FLOATING_PARTICLES.map((particle, index) => (
          <motion.div
            key={`${particle.left}-${particle.top}`}
            className="absolute h-1.5 w-1.5 rounded-full bg-white/65"
            style={{ left: particle.left, top: particle.top }}
            animate={
              isActive
                ? {
                    y: [0, particle.driftY, 0],
                    x: [0, particle.driftX, 0],
                    opacity: [0.25, 1, 0.25],
                    scale: [0.7, 1.1, 0.7],
                  }
                : {
                    y: [0, particle.driftY * 0.55, 0],
                    x: [0, particle.driftX * 0.55, 0],
                    opacity: [0.12, 0.4, 0.12],
                    scale: [0.55, 0.9, 0.55],
                  }
            }
            transition={{
              duration: 2.6,
              repeat: Number.POSITIVE_INFINITY,
              delay: particle.delay + index * 0.04,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="relative z-20 flex min-h-screen items-end px-6 pb-36 pt-24 md:px-10 md:pb-40">
        <div className="max-w-3xl">
          {trustBadge ? (
            <motion.div
              className="mb-6 inline-flex items-center rounded-full border border-white/12 bg-white/[0.06] px-4 py-2.5 backdrop-blur-sm"
              style={{ filter: "url(#glass-effect)" }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
            >
              <div className="absolute left-1 right-1 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />
              <span className="relative z-10 flex items-center gap-2 text-sm font-medium tracking-wide text-white/90">
                {trustBadge.icons?.map((icon, index) => (
                  <span key={`${icon}-${index}`}>{icon}</span>
                ))}
                <span>{trustBadge.text}</span>
              </span>
            </motion.div>
          ) : null}

          <motion.h1
            className="mb-6 text-5xl font-bold leading-none tracking-tight text-white md:text-7xl lg:text-8xl"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.28 }}
          >
            <span
              className="mb-2 block text-3xl font-light tracking-[0.12em] text-cyan-200 md:text-5xl lg:text-6xl"
              style={{ textShadow: "0 0 24px rgba(6,182,212,0.2)" }}
            >
              {headline.line1}
            </span>
            <span className="block font-black text-white drop-shadow-2xl">
              {headline.line2}
            </span>
          </motion.h1>

          <motion.p
            className="max-w-2xl text-base leading-8 text-white/72 md:text-lg"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.56, delay: 0.46 }}
          >
            {subtitle}
          </motion.p>

          {actionSlot ? (
            <motion.div
              className="mt-8 flex items-center gap-4"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.56, delay: 0.62 }}
            >
              {actionSlot}
            </motion.div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-36 right-6 z-20 hidden md:block">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <PulsingBorder
            key={`hero-ring-${refreshToken}`}
            colors={["#06b6d4", "#0891b2", "#f97316", "#ffffff"]}
            colorBack="#00000000"
            speed={1.5}
            roundness={1}
            thickness={0.1}
            softness={0.2}
            intensity={5}
            spots={4}
            spotSize={0.1}
            pulse={0.1}
            smoke={0.5}
            smokeSize={4}
            scale={0.65}
            rotation={0}
            style={{
              width: "68px",
              height: "68px",
              borderRadius: "999px",
            }}
          />

          <motion.svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            animate={{ rotate: 360 }}
            transition={{
              duration: 20,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
            style={{ transform: "scale(1.48)" }}
          >
            <defs>
              <path
                id="hero-ring-circle"
                d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
              />
            </defs>
            <text className="fill-white/80 text-[7px] font-medium uppercase tracking-[0.3em]">
              <textPath href="#hero-ring-circle" startOffset="0%">
                {ringText}
              </textPath>
            </text>
          </motion.svg>
        </div>
      </div>
    </div>
  );
}
