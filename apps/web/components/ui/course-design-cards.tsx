"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CourseDesignCardData {
  id: string;
  colorClass: "green" | "orange" | "red" | "blue";
  eyebrow: string;
  title: string;
  description: string;
  progressLabel: string;
  progressPercent: number;
  progressValue: string;
  chips: string[];
  countdownText: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface CardProps {
  data: CourseDesignCardData;
}

const COLOR_STYLES: Record<
  CourseDesignCardData["colorClass"],
  {
    gradient: string;
    glow: string;
    iconShell: string;
    accent: string;
    progress: string;
    chip: string;
    status: string;
    action: string;
  }
> = {
  green: {
    gradient: "from-[#0d2f2b] via-[#123f36] to-[#08131f]",
    glow: "shadow-[0_24px_80px_rgba(1,195,168,0.18)]",
    iconShell: "bg-emerald-300/18 text-emerald-100",
    accent: "text-emerald-200",
    progress: "from-emerald-300 via-emerald-400 to-cyan-300",
    chip: "border-emerald-300/18 bg-emerald-400/14 text-emerald-50",
    status: "border-emerald-300/18 bg-emerald-400/12 text-emerald-50",
    action: "bg-emerald-300 text-slate-950 hover:bg-emerald-200",
  },
  orange: {
    gradient: "from-[#3a2714] via-[#5a3517] to-[#08131f]",
    glow: "shadow-[0_24px_80px_rgba(255,183,65,0.18)]",
    iconShell: "bg-amber-300/18 text-amber-100",
    accent: "text-amber-100",
    progress: "from-amber-200 via-orange-300 to-amber-400",
    chip: "border-amber-300/18 bg-amber-400/14 text-amber-50",
    status: "border-amber-300/18 bg-amber-400/12 text-amber-50",
    action: "bg-amber-200 text-slate-950 hover:bg-amber-100",
  },
  red: {
    gradient: "from-[#351516] via-[#4e1d1e] to-[#08131f]",
    glow: "shadow-[0_24px_80px_rgba(239,125,102,0.18)]",
    iconShell: "bg-rose-300/18 text-rose-100",
    accent: "text-rose-100",
    progress: "from-rose-200 via-rose-300 to-orange-300",
    chip: "border-rose-300/18 bg-rose-400/14 text-rose-50",
    status: "border-rose-300/18 bg-rose-400/12 text-rose-50",
    action: "bg-rose-200 text-slate-950 hover:bg-rose-100",
  },
  blue: {
    gradient: "from-[#112a43] via-[#163a60] to-[#08131f]",
    glow: "shadow-[0_24px_80px_rgba(24,144,255,0.18)]",
    iconShell: "bg-cyan-300/18 text-cyan-100",
    accent: "text-cyan-100",
    progress: "from-cyan-200 via-blue-300 to-cyan-300",
    chip: "border-cyan-300/18 bg-cyan-400/14 text-cyan-50",
    status: "border-cyan-300/18 bg-cyan-400/12 text-cyan-50",
    action: "bg-cyan-200 text-slate-950 hover:bg-cyan-100",
  },
};

function getChipLabel(value: string) {
  return value.length > 22 ? `${value.slice(0, 21)}…` : value;
}

function getLevelIcon(colorClass: CourseDesignCardData["colorClass"]) {
  if (colorClass === "green") {
    return Shield;
  }

  if (colorClass === "red") {
    return TriangleAlert;
  }

  return Sparkles;
}

export default function CourseDesignCard({ data }: CardProps) {
  const {
    colorClass,
    eyebrow,
    title,
    description,
    progressLabel,
    progressPercent,
    progressValue,
    chips,
    countdownText,
    actionLabel = "Explore",
    onAction,
  } = data;

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const colorStyles = COLOR_STYLES[colorClass];
  const LevelIcon = useMemo(() => getLevelIcon(colorClass), [colorClass]);

  const handleMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setMousePos({
      x: (x / rect.width - 0.5) * 14,
      y: (y / rect.height - 0.5) * -14,
    });
  }, []);

  const handleLeave = useCallback(() => {
    setHovered(false);
    setMousePos({ x: 0, y: 0 });
  }, []);

  return (
    <motion.article
      className={cn(
        "group relative flex min-h-[356px] flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#09131c] p-6 text-white transition-transform duration-300",
        colorStyles.glow,
      )}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleLeave}
      animate={{
        rotateX: mousePos.y,
        rotateY: mousePos.x,
        y: hovered ? -6 : 0,
      }}
      transition={{ type: "spring", stiffness: 280, damping: 24, mass: 0.9 }}
      style={{ transformStyle: "preserve-3d", perspective: "1200px" }}
    >
      <motion.div
        className={cn("absolute inset-0 bg-gradient-to-br opacity-100", colorStyles.gradient)}
        animate={{ scale: hovered ? 1.02 : 1 }}
        transition={{ duration: 0.35 }}
        style={{ transform: "translateZ(-12px)" }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_28%)] opacity-70" />

      <motion.div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(135deg, transparent 20%, rgba(255,255,255,0.08) 50%, transparent 80%)",
          transform: "translateZ(18px)",
        }}
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/55">
            {eyebrow}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl backdrop-blur-sm ring-1 ring-white/10",
                colorStyles.iconShell,
              )}
            >
              <LevelIcon className="h-5 w-5" />
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">
              {progressValue} AI
            </div>
          </div>
        </div>

        <div className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]", colorStyles.status)}>
          {countdownText}
        </div>
      </div>

      <div className="relative z-10 mt-8">
        <h3 className="max-w-[14ch] text-[1.9rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
          {title}
        </h3>
        <p className="mt-4 max-w-[32ch] text-sm leading-6 text-white/74">
          {description}
        </p>
      </div>

      <div className="relative z-10 mt-7 space-y-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="text-white/64">{progressLabel}</span>
          <span className={cn("font-semibold uppercase tracking-[0.2em]", colorStyles.accent)}>
            {progressValue}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-300", colorStyles.progress)}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="relative z-10 mt-auto pt-8">
        <div className="flex flex-wrap items-center gap-2">
          {chips.slice(0, 2).map((chip) => (
            <span
              key={chip}
              className={cn(
                "rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]",
                colorStyles.chip,
              )}
              title={chip}
            >
              {getChipLabel(chip)}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.22em] text-white/48">
            Click to search this exact role
          </div>
          <button
            type="button"
            onClick={onAction}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
              colorStyles.action,
            )}
            disabled={!onAction}
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
