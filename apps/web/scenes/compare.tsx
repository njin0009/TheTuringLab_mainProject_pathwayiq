"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUIZ_DIMENSIONS, type QuizDimensionId } from "@/lib/quiz-data";
import careerCardsData from "../public/data2/career-cards.json";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DataCareerRecord {
  title: string;
  pathway: string;
  industry: string;
  anzsco_code: string;
  median_salary: number;
  shortage_status: string;
}

interface EnrichedCareer extends DataCareerRecord {
  styleId: QuizDimensionId;
}

export interface CompareSceneProps {
  seedTitles?: [string | null, string | null];
  seedKey?: number;
  onReport: (careerTitle: string | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Style rules & visuals
// ─────────────────────────────────────────────────────────────────────────────

interface StyleRule {
  industries: string[];
  pathways: string[];
  titleKeywords: string[];
}

const STYLE_RULES: Record<QuizDimensionId, StyleRule> = {
  builder: {
    industries: ["Engineering", "Construction", "Agriculture & Environment", "Healthcare"],
    pathways: ["Apprenticeship", "TAFE"],
    titleKeywords: ["electrician", "plumber", "carpenter", "mechanic", "technician", "cabler", "track", "maint", "welder"],
  },
  decoder: {
    industries: ["Technology", "Engineering", "Business", "Science"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: ["analyst", "developer", "software", "engineer", "ict", "data", "security", "quality", "consultant"],
  },
  creator: {
    industries: ["Creative Industries", "Technology", "Education", "Business", "Construction"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: ["designer", "graphic", "interior", "draftsperson", "marketing", "creative", "signwriter"],
  },
  guide: {
    industries: ["Healthcare", "Community Services", "Education"],
    pathways: ["TAFE"],
    titleKeywords: ["nurse", "therapy", "health", "care", "social", "community", "teacher", "support"],
  },
  catalyst: {
    industries: ["Business", "Technology", "Engineering", "Construction"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: ["manager", "project", "sales", "lead", "executive", "transport", "organiser"],
  },
  strategist: {
    industries: ["Business", "Education", "Technology", "Engineering", "Community Services"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: ["manager", "analyst", "planning", "policy", "project", "administrator", "coordinator"],
  },
};

const STYLE_VISUALS: Record<
  QuizDimensionId,
  {
    borderClass: string;
    softClass: string;
    chipClass: string;
    glowClass: string;
    accentBarClass: string;
    barClass: string;
    glowRgb: string;
  }
> = {
  builder: {
    borderClass: "border-cyan-300/35",
    softClass: "bg-cyan-300/[0.08]",
    chipClass: "border-cyan-300/35 bg-cyan-300/15 text-cyan-100",
    glowClass: "shadow-[0_0_0_1px_rgba(103,232,249,0.12),0_20px_60px_rgba(12,74,110,0.32)]",
    accentBarClass: "from-cyan-300 via-sky-300 to-teal-300",
    barClass: "bg-gradient-to-r from-cyan-400 to-sky-400",
    glowRgb: "6,182,212",
  },
  decoder: {
    borderClass: "border-violet-300/35",
    softClass: "bg-violet-300/[0.08]",
    chipClass: "border-violet-300/35 bg-violet-300/15 text-violet-100",
    glowClass: "shadow-[0_0_0_1px_rgba(196,181,253,0.12),0_20px_60px_rgba(76,29,149,0.32)]",
    accentBarClass: "from-violet-300 via-fuchsia-300 to-sky-300",
    barClass: "bg-gradient-to-r from-violet-400 to-fuchsia-400",
    glowRgb: "139,92,246",
  },
  creator: {
    borderClass: "border-fuchsia-300/35",
    softClass: "bg-fuchsia-300/[0.08]",
    chipClass: "border-fuchsia-300/35 bg-fuchsia-300/15 text-fuchsia-100",
    glowClass: "shadow-[0_0_0_1px_rgba(244,114,182,0.12),0_20px_60px_rgba(131,24,67,0.3)]",
    accentBarClass: "from-pink-300 via-fuchsia-300 to-orange-200",
    barClass: "bg-gradient-to-r from-fuchsia-400 to-pink-400",
    glowRgb: "217,70,239",
  },
  guide: {
    borderClass: "border-emerald-300/35",
    softClass: "bg-emerald-300/[0.08]",
    chipClass: "border-emerald-300/35 bg-emerald-300/15 text-emerald-100",
    glowClass: "shadow-[0_0_0_1px_rgba(110,231,183,0.12),0_20px_60px_rgba(6,78,59,0.32)]",
    accentBarClass: "from-emerald-300 via-teal-300 to-cyan-300",
    barClass: "bg-gradient-to-r from-emerald-400 to-teal-400",
    glowRgb: "16,185,129",
  },
  catalyst: {
    borderClass: "border-amber-300/35",
    softClass: "bg-amber-300/[0.08]",
    chipClass: "border-amber-300/35 bg-amber-300/15 text-amber-100",
    glowClass: "shadow-[0_0_0_1px_rgba(253,230,138,0.12),0_20px_60px_rgba(133,77,14,0.3)]",
    accentBarClass: "from-amber-300 via-orange-300 to-rose-300",
    barClass: "bg-gradient-to-r from-amber-400 to-orange-400",
    glowRgb: "245,158,11",
  },
  strategist: {
    borderClass: "border-sky-300/35",
    softClass: "bg-sky-300/[0.08]",
    chipClass: "border-sky-300/35 bg-sky-300/15 text-sky-100",
    glowClass: "shadow-[0_0_0_1px_rgba(125,211,252,0.12),0_20px_60px_rgba(8,47,73,0.34)]",
    accentBarClass: "from-sky-300 via-indigo-300 to-cyan-300",
    barClass: "bg-gradient-to-r from-sky-400 to-indigo-400",
    glowRgb: "14,165,233",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Filter constants
// ─────────────────────────────────────────────────────────────────────────────

const ALL_INDUSTRIES = [
  "Healthcare", "Business", "Technology", "Engineering", "Construction",
  "Agriculture & Environment", "Community Services", "Creative Industries", "Education", "Science",
];

const ALL_PATHWAYS = ["TAFE", "Apprenticeship", "University", "Online"];

const ALL_STYLE_IDS: QuizDimensionId[] = [
  "builder", "decoder", "creator", "guide", "catalyst", "strategist",
];

// ─────────────────────────────────────────────────────────────────────────────
// Data helpers
// ─────────────────────────────────────────────────────────────────────────────

const DATA2_CAREERS = careerCardsData as DataCareerRecord[];

function inferCareerStyleId(career: DataCareerRecord): QuizDimensionId {
  const scored = (Object.keys(STYLE_RULES) as QuizDimensionId[])
    .map((styleId) => {
      const rule = STYLE_RULES[styleId];
      const iIdx = rule.industries.findIndex((i) => i === career.industry);
      const iScore = iIdx === -1 ? 0 : Math.max(20 - iIdx * 4, 8);
      const pScore = rule.pathways.includes(career.pathway) ? 10 : 0;
      const kScore = rule.titleKeywords.reduce(
        (s, kw) => (career.title.toLowerCase().includes(kw) ? s + 6 : s),
        0,
      );
      return { styleId, score: iScore + pScore + kScore };
    })
    .sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.styleId.localeCompare(b.styleId),
    );
  return scored[0]?.styleId ?? "strategist";
}

function enrich(career: DataCareerRecord): EnrichedCareer {
  return { ...career, styleId: inferCareerStyleId(career) };
}

const CAREER_MAP = new Map<string, EnrichedCareer>(
  DATA2_CAREERS.map((c) => [c.title, enrich(c)]),
);

function formatSalary(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function shortageScore(status: string): number {
  if (status === "In Shortage") return 90;
  if (status.toLowerCase().includes("shortage")) return 60;
  return 15;
}

// ─────────────────────────────────────────────────────────────────────────────
// SlotButton
// ─────────────────────────────────────────────────────────────────────────────

function SlotButton({
  slot,
  career,
  isActive,
  onClick,
}: {
  slot: "A" | "B";
  career: EnrichedCareer | null;
  isActive: boolean;
  onClick: () => void;
}) {
  const theme = career ? STYLE_VISUALS[career.styleId] : null;
  const dim = career ? QUIZ_DIMENSIONS[career.styleId] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-[22px] border p-4 text-left transition-all duration-200",
        isActive
          ? "border-white/25 bg-white/[0.09] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          : career
            ? cn("bg-white/[0.04] hover:bg-white/[0.07]", theme?.borderClass)
            : "border-dashed border-white/12 bg-white/[0.03] hover:border-white/22 hover:bg-white/[0.06]",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border transition",
            career
              ? cn("border-white/15 bg-white/90", theme?.borderClass)
              : "border-white/12 bg-white/[0.05] text-slate-500",
          )}
        >
          {dim ? (
            <img src={dim.illustrationSrc} alt="" className="h-8 w-8 object-contain" />
          ) : (
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{slot}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {career ? (
            <>
              <div className="truncate text-sm font-semibold text-white">{career.title}</div>
              <div className="mt-0.5 text-xs text-slate-400">
                {career.industry} · {career.pathway}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-slate-400">Role {slot}</div>
              <div className="mt-0.5 text-xs text-slate-500">Click to select a career</div>
            </>
          )}
        </div>

        <div className="shrink-0">
          {career && theme ? (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
                theme.chipClass,
              )}
            >
              {QUIZ_DIMENSIONS[career.styleId].label}
            </span>
          ) : (
            <ChevronRight
              className={cn(
                "h-4 w-4 text-slate-500 transition-transform duration-200",
                isActive && "rotate-90",
              )}
            />
          )}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CareerFilterPanel
// ─────────────────────────────────────────────────────────────────────────────

function CareerFilterPanel({
  slot,
  excludeTitle,
  onSelect,
  onClose,
}: {
  slot: "A" | "B";
  excludeTitle: string | null;
  onSelect: (career: EnrichedCareer) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [pathway, setPathway] = useState<string | null>(null);
  const [styleFilter, setStyleFilter] = useState<QuizDimensionId | null>(null);

  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    return Array.from(CAREER_MAP.values())
      .filter((c) => {
        if (excludeTitle && c.title === excludeTitle) return false;
        if (industry && c.industry !== industry) return false;
        if (pathway && c.pathway !== pathway) return false;
        if (styleFilter && c.styleId !== styleFilter) return false;
        if (q && !c.title.toLowerCase().includes(q)) return false;
        return true;
      })
      .slice(0, 80);
  }, [search, industry, pathway, styleFilter, excludeTitle]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden rounded-[22px] border border-white/12 bg-[#0b151f] shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          Select Role {slot}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filter panel"
          className="rounded-full p-1.5 text-slate-500 transition hover:bg-white/8 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            type="text"
            placeholder="Search by career title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch("")}>
              <X className="h-3 w-3 text-slate-500" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 border-b border-white/8 px-4 py-3">
        {/* Style filter */}
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
            Style
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_STYLE_IDS.map((sid) => {
              const v = STYLE_VISUALS[sid];
              const active = styleFilter === sid;
              return (
                <button
                  key={sid}
                  type="button"
                  onClick={() => setStyleFilter(active ? null : sid)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition",
                    active
                      ? v.chipClass
                      : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white",
                  )}
                >
                  {QUIZ_DIMENSIONS[sid].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Industry filter */}
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
            Industry
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_INDUSTRIES.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => setIndustry(industry === ind ? null : ind)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition",
                  industry === ind
                    ? "border-sky-300/40 bg-sky-400/15 text-sky-100"
                    : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white",
                )}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        {/* Pathway filter */}
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
            Pathway
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_PATHWAYS.map((pw) => (
              <button
                key={pw}
                type="button"
                onClick={() => setPathway(pathway === pw ? null : pw)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition",
                  pathway === pw
                    ? "border-violet-300/40 bg-violet-400/15 text-violet-100"
                    : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white",
                )}
              >
                {pw}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results list */}
      <div className="max-h-60 overflow-y-auto">
        {results.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            No careers match these filters
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {results.map((career) => {
              const theme = STYLE_VISUALS[career.styleId];
              const dim = QUIZ_DIMENSIONS[career.styleId];
              return (
                <button
                  key={career.title}
                  type="button"
                  onClick={() => onSelect(career)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border bg-white/90",
                      theme.borderClass,
                    )}
                  >
                    <img src={dim.illustrationSrc} alt="" className="h-7 w-7 object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{career.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {career.industry} · {career.pathway}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-semibold text-slate-300">
                      {formatSalary(career.median_salary)}
                    </div>
                    {career.shortage_status === "In Shortage" && (
                      <div className="mt-0.5 text-[10px] font-semibold text-emerald-400">
                        In Shortage
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CareerShowcase  (spatial-product-showcase adapted for 2 careers)
// ─────────────────────────────────────────────────────────────────────────────

function CareerShowcase({
  careerA,
  careerB,
  focusedSlot,
  onFocusChange,
}: {
  careerA: EnrichedCareer;
  careerB: EnrichedCareer;
  focusedSlot: "A" | "B";
  onFocusChange: (slot: "A" | "B") => void;
}) {
  const focused = focusedSlot === "A" ? careerA : careerB;
  const other = focusedSlot === "A" ? careerB : careerA;
  const theme = STYLE_VISUALS[focused.styleId];
  const dim = QUIZ_DIMENSIONS[focused.styleId];
  const dimA = QUIZ_DIMENSIONS[careerA.styleId];
  const dimB = QUIZ_DIMENSIONS[careerB.styleId];
  const themeA = STYLE_VISUALS[careerA.styleId];
  const themeB = STYLE_VISUALS[careerB.styleId];

  const maxSalary = Math.max(careerA.median_salary, careerB.median_salary);
  const salaryPct = Math.round((focused.median_salary / maxSalary) * 100);
  const shortagePct = shortageScore(focused.shortage_status);
  const otherShortName = other.title.split(" ").slice(0, 3).join(" ");

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#09131c]">
      {/* Animated background gradient keyed on focused style */}
      <motion.div
        key={focused.styleId}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.65 }}
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 12% 50%, rgba(${theme.glowRgb}, 0.13) 0%, transparent 52%)`,
        }}
      />

      {/* Accent bar */}
      <div className={cn("absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r", theme.accentBarClass)} />

      {/* Switcher tabs */}
      <div className="relative z-10 flex items-center gap-2 p-4 pb-2">
        {(["A", "B"] as const).map((slot) => {
          const career = slot === "A" ? careerA : careerB;
          const slotTheme = slot === "A" ? themeA : themeB;
          const slotDim = slot === "A" ? dimA : dimB;
          const active = focusedSlot === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onFocusChange(slot)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200",
                active
                  ? cn("bg-white/[0.1] text-white", slotTheme.borderClass)
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200",
              )}
            >
              <img src={slotDim.illustrationSrc} alt="" className="h-5 w-5 object-contain" />
              <span className="max-w-[160px] truncate">{career.title}</span>
            </button>
          );
        })}
      </div>

      {/* Main animated showcase area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={focused.title}
          initial={{ opacity: 0, x: focusedSlot === "A" ? -16 : 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: focusedSlot === "A" ? 16 : -16, filter: "blur(6px)" }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="relative z-10 grid gap-6 p-6 md:grid-cols-[190px_1fr]"
        >
          {/* Style illustration */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className={cn(
                  "absolute -inset-5 rounded-full border border-dashed opacity-25",
                  theme.borderClass,
                )}
              />
              <motion.div
                animate={{ y: [-7, 7, -7] }}
                transition={{ repeat: Infinity, duration: 5.5, ease: "easeInOut" }}
                className="relative"
              >
                <div
                  className={cn(
                    "relative flex h-36 w-36 items-center justify-center rounded-[36px] border bg-white/90 shadow-[0_20px_56px_rgba(0,0,0,0.35)]",
                    theme.borderClass,
                  )}
                >
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className={cn(
                      "absolute inset-0 rounded-[36px] opacity-15 bg-gradient-to-br blur-md",
                      theme.accentBarClass,
                    )}
                  />
                  <img
                    src={dim.illustrationSrc}
                    alt={dim.label}
                    className="relative h-28 w-28 object-contain"
                  />
                </div>
              </motion.div>
            </div>
            <div className="mt-6 text-center">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                  theme.chipClass,
                )}
              >
                {dim.label}
              </span>
              <div className="mt-2 text-xs text-slate-500">{focused.industry}</div>
            </div>
          </div>

          {/* Career details */}
          <div>
            <h3 className="text-2xl font-semibold leading-tight text-white">{focused.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{dim.tagline}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-200">
                {focused.pathway}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-200">
                {focused.anzsco_code}
              </span>
              {focused.shortage_status !== "Not in Shortage" && (
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  {focused.shortage_status}
                </span>
              )}
            </div>

            {/* Metric bars */}
            <div className="mt-5 space-y-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Median Salary</span>
                  <span className="font-semibold text-white">
                    {formatSalary(focused.median_salary)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    key={focused.title + "-salary"}
                    initial={{ width: 0 }}
                    animate={{ width: `${salaryPct}%` }}
                    transition={{ duration: 0.75, delay: 0.1 }}
                    className={cn("h-full rounded-full", theme.barClass)}
                  />
                </div>
                <div className="mt-1.5 text-[10px] text-slate-600">
                  vs {formatSalary(other.median_salary)} for {otherShortName}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Demand Signal</span>
                  <span className="font-semibold text-white">{focused.shortage_status}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    key={focused.title + "-shortage"}
                    initial={{ width: 0 }}
                    animate={{ width: `${shortagePct}%` }}
                    transition={{ duration: 0.75, delay: 0.2 }}
                    className={cn("h-full rounded-full", theme.barClass)}
                  />
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 pt-1">
                <span className="text-xs text-slate-400">Work Vibe</span>
                <span className="text-right text-xs font-medium leading-5 text-slate-200">
                  {dim.workLikes.slice(0, 3).join(" · ")}
                </span>
              </div>
            </div>

          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CompareTable
// ─────────────────────────────────────────────────────────────────────────────

function CompareTable({
  careerA,
  careerB,
}: {
  careerA: EnrichedCareer;
  careerB: EnrichedCareer;
}) {
  const themeA = STYLE_VISUALS[careerA.styleId];
  const themeB = STYLE_VISUALS[careerB.styleId];
  const dimA = QUIZ_DIMENSIONS[careerA.styleId];
  const dimB = QUIZ_DIMENSIONS[careerB.styleId];

  const rows = [
    { label: "Median Salary", a: formatSalary(careerA.median_salary), b: formatSalary(careerB.median_salary) },
    { label: "Shortage Status", a: careerA.shortage_status, b: careerB.shortage_status },
    { label: "Industry", a: careerA.industry, b: careerB.industry },
    { label: "Pathway", a: careerA.pathway, b: careerB.pathway },
    { label: "Style", a: dimA.label, b: dimB.label },
    { label: "ANZSCO", a: careerA.anzsco_code, b: careerB.anzsco_code },
  ];

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]">
      <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-white/10 bg-white/[0.03]">
        <div className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Field
        </div>
        <div className="flex items-center gap-2 px-5 py-4">
          <div className={cn("h-2 w-2 rounded-full bg-gradient-to-br", themeA.accentBarClass)} />
          <span className="truncate text-sm font-semibold text-white">{careerA.title}</span>
        </div>
        <div className="flex items-center gap-2 px-5 py-4">
          <div className={cn("h-2 w-2 rounded-full bg-gradient-to-br", themeB.accentBarClass)} />
          <span className="truncate text-sm font-semibold text-white">{careerB.title}</span>
        </div>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={cn(
            "grid grid-cols-[1fr_1fr_1fr] items-start",
            i < rows.length - 1 && "border-b border-white/[0.06]",
          )}
        >
          <div className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            {row.label}
          </div>
          <div className="px-5 py-4 text-sm leading-6 text-slate-200">{row.a}</div>
          <div className="px-5 py-4 text-sm leading-6 text-slate-200">{row.b}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SingleCareerDisplay  (only one slot filled)
// ─────────────────────────────────────────────────────────────────────────────

function SingleCareerDisplay({ career }: { career: EnrichedCareer }) {
  const theme = STYLE_VISUALS[career.styleId];
  const dim = QUIZ_DIMENSIONS[career.styleId];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[32px] border bg-[#09131c] p-8",
        theme.borderClass,
        theme.glowClass,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r", theme.accentBarClass)} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 85% 15%, rgba(${theme.glowRgb}, 0.1), transparent 40%)`,
        }}
      />
      <div className="relative z-10 flex flex-col items-center py-8 text-center">
        <motion.div
          animate={{ y: [-8, 8, -8] }}
          transition={{ repeat: Infinity, duration: 5.5, ease: "easeInOut" }}
          className={cn(
            "flex h-36 w-36 items-center justify-center rounded-[40px] border bg-white/90 shadow-[0_24px_64px_rgba(0,0,0,0.32)]",
            theme.borderClass,
          )}
        >
          <img src={dim.illustrationSrc} alt="" className="h-28 w-28 object-contain" />
        </motion.div>

        <div className="mt-5">
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
              theme.chipClass,
            )}
          >
            {dim.label}
          </span>
        </div>

        <h3 className="mt-4 text-3xl font-semibold text-white">{career.title}</h3>
        <p className="mt-2 max-w-[38ch] text-sm leading-6 text-slate-400">{dim.tagline}</p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-200">
            {career.industry}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-200">
            {career.pathway}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-200">
            {formatSalary(career.median_salary)}
          </span>
        </div>

        <div className="mt-8 rounded-[20px] border border-dashed border-white/12 bg-white/[0.03] px-8 py-6">
          <div className="text-sm font-semibold text-slate-400">Select Role B to compare</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Use the selector on the left to pick a second career and see the full side-by-side breakdown.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex min-h-[480px] flex-col items-center justify-center rounded-[32px] border border-dashed border-white/10 bg-white/[0.02] px-8 text-center">
      <div className="rounded-full border border-white/10 bg-white/[0.05] p-4">
        <ArrowRight className="h-6 w-6 text-slate-500" />
      </div>
      <h3 className="mt-6 text-2xl font-semibold text-white">Pick two careers to compare</h3>
      <p className="mt-3 max-w-[36ch] text-sm leading-6 text-slate-400">
        Use the selector on the left to choose Role A and Role B. Filter by industry, pathway, or style to find careers quickly.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CompareScene  (main export)
// ─────────────────────────────────────────────────────────────────────────────

export default function CompareScene({
  seedTitles,
  seedKey,
  onReport,
}: CompareSceneProps) {
  const [slotA, setSlotA] = useState<EnrichedCareer | null>(null);
  const [slotB, setSlotB] = useState<EnrichedCareer | null>(null);
  const [activeSlot, setActiveSlot] = useState<"A" | "B" | null>(null);
  const [focusedSlot, setFocusedSlot] = useState<"A" | "B">("A");

  // Initialise slots from parent seed (e.g. navigating from Explore or Report).
  // Keyed on seedKey so changing the key re-runs the effect even if titles are identical.
  useEffect(() => {
    if (!seedTitles) return;
    const [titleA, titleB] = seedTitles;
    const careerA = titleA ? (CAREER_MAP.get(titleA) ?? null) : null;
    const careerB = titleB ? (CAREER_MAP.get(titleB) ?? null) : null;
    setSlotA(careerA);
    setSlotB(careerB);
    setActiveSlot(null);
    if (careerA && !careerB) setActiveSlot("B");
    if (careerA) setFocusedSlot("A");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  function handleSelectCareer(career: EnrichedCareer) {
    if (activeSlot === "A") {
      setSlotA(career);
      setFocusedSlot("A");
    } else {
      setSlotB(career);
      setFocusedSlot("B");
    }
    setActiveSlot(null);
  }

  function handleSlotClick(slot: "A" | "B") {
    setFocusedSlot(slot);
    setActiveSlot((current) => (current === slot ? null : slot));
  }

  const excludeTitle = activeSlot === "A" ? (slotB?.title ?? null) : (slotA?.title ?? null);
  const filledCount = [slotA, slotB].filter(Boolean).length;
  const reportCareer = focusedSlot === "B" ? slotB : slotA;

  return (
    <section className="relative h-screen w-screen shrink-0 snap-start overflow-y-auto px-6 pb-36 pt-28">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 xl:grid-cols-[400px_1fr]">

          {/* ── LEFT PANEL ── */}
          <div className="space-y-4 xl:sticky xl:top-28 xl:self-start">

            {/* Scene header card */}
            <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7dd3fc]">
                Scene 04
              </div>
              <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-white">
                Compare two careers
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Search 400+ careers and filter by industry, pathway, or style — then pick two for a full side-by-side breakdown.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[18px] border border-sky-400/20 bg-sky-400/[0.08] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-300/80">
                    Careers
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-white">
                    {DATA2_CAREERS.length}+
                  </div>
                </div>
                <div className="rounded-[18px] border border-fuchsia-400/20 bg-fuchsia-400/[0.08] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-300/80">
                    Selected
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-white">{filledCount}/2</div>
                </div>
              </div>
            </div>

            {/* Slot A button */}
            <SlotButton
              slot="A"
              career={slotA}
              isActive={activeSlot === "A"}
              onClick={() => handleSlotClick("A")}
            />

            {/* Slot B button */}
            <SlotButton
              slot="B"
              career={slotB}
              isActive={activeSlot === "B"}
              onClick={() => handleSlotClick("B")}
            />

            {/* Filter panel (animated) */}
            <AnimatePresence>
              {activeSlot && (
                <CareerFilterPanel
                  key={activeSlot}
                  slot={activeSlot}
                  excludeTitle={excludeTitle}
                  onSelect={handleSelectCareer}
                  onClose={() => setActiveSlot(null)}
                />
              )}
            </AnimatePresence>

            {/* Continue to Report */}
            <AnimatePresence>
              {slotA && slotB && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4"
                >
                  <p className="text-xs leading-5 text-slate-400">
                    Ready to dive deeper? Generate a full career report for Role {focusedSlot}:{" "}
                    <span className="font-semibold text-slate-200">{reportCareer?.title}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={() => onReport(reportCareer?.title ?? slotA.title)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#57b6ff] px-5 py-3 font-semibold text-[#02121f] transition hover:-translate-y-px hover:bg-[#7cc8ff]"
                  >
                    Continue to Role {focusedSlot} Report
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="space-y-6">
            {slotA && slotB ? (
              <>
                <CareerShowcase
                  careerA={slotA}
                  careerB={slotB}
                  focusedSlot={focusedSlot}
                  onFocusChange={setFocusedSlot}
                />
                <CompareTable careerA={slotA} careerB={slotB} />
              </>
            ) : slotA ?? slotB ? (
              <SingleCareerDisplay career={(slotA ?? slotB)!} />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
