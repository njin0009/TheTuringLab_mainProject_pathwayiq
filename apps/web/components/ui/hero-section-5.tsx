"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type MilestoneStatus = "complete" | "in-progress" | "pending";

interface Milestone {
  id: number;
  name: string;
  status: MilestoneStatus;
  note?: string;
}

interface AnimatedRoadmapProps extends React.HTMLAttributes<HTMLDivElement> {
  milestones: Milestone[];
  caption?: string;
}

const statusDotClasses: Record<MilestoneStatus, string> = {
  complete: "bg-emerald-400 border-emerald-200 shadow-[0_0_0_6px_rgba(52,211,153,0.12)]",
  "in-progress":
    "bg-cyan-300 border-cyan-100 shadow-[0_0_0_8px_rgba(34,211,238,0.18)] animate-pulse",
  pending: "bg-slate-700 border-slate-500/60 shadow-[0_0_0_6px_rgba(15,23,42,0.35)]",
};

const statusPillClasses: Record<MilestoneStatus, string> = {
  complete: "border-emerald-300/28 bg-emerald-400/12 text-emerald-100",
  "in-progress": "border-cyan-300/28 bg-cyan-400/12 text-cyan-100",
  pending: "border-white/10 bg-white/[0.04] text-slate-300",
};

const AnimatedRoadmap = React.forwardRef<HTMLDivElement, AnimatedRoadmapProps>(
  ({ className, milestones, caption, ...props }, ref) => {
    const completeCount = milestones.filter((milestone) => milestone.status === "complete").length;
    const activeIndex = milestones.findIndex((milestone) => milestone.status === "in-progress");
    const progressStops =
      activeIndex >= 0
        ? (completeCount + 0.5) / Math.max(milestones.length - 1, 1)
        : completeCount / Math.max(milestones.length - 1, 1);
    const progressPercent = Math.max(0, Math.min(progressStops * 100, 100));

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5",
          className,
        )}
        {...props}
      >
        <div className="absolute inset-0 opacity-35">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200/85">
                Quiz roadmap
              </div>
              {caption ? (
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {caption}
                </p>
              ) : null}
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
              {milestones.length} stops
            </div>
          </div>

          <div className="relative mt-6">
            <div className="absolute left-[10%] right-[10%] top-4 h-px border-t border-dashed border-white/14" />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="absolute left-[10%] top-4 h-px border-t border-dashed border-cyan-300/70"
            />

            <div className="grid grid-cols-4 gap-3">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={milestone.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.35, ease: "easeOut" }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="relative flex h-8 w-8 items-center justify-center">
                    <div
                      className={cn(
                        "absolute h-4 w-4 rounded-full border-2",
                        statusDotClasses[milestone.status],
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "mt-3 w-full rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em]",
                      statusPillClasses[milestone.status],
                    )}
                  >
                    {milestone.name}
                  </div>
                  {milestone.note ? (
                    <div className="mt-2 text-xs leading-5 text-slate-400">
                      {milestone.note}
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

AnimatedRoadmap.displayName = "AnimatedRoadmap";

export { AnimatedRoadmap };
