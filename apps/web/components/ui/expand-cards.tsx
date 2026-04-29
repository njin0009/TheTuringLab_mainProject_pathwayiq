"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { QuizDimensionDefinition, QuizDimensionId } from "@/lib/quiz-data";

interface ExpandCardsProps {
  open: boolean;
  onClose: () => void;
  items: QuizDimensionDefinition[];
  initialStyleId?: QuizDimensionId;
}

export default function ExpandCards({
  open,
  onClose,
  items,
  initialStyleId,
}: ExpandCardsProps) {
  const firstItemId = items[0]?.id;
  const resolvedInitialId = initialStyleId ?? firstItemId;
  const [expandedId, setExpandedId] = useState<QuizDimensionId | undefined>(resolvedInitialId);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setExpandedId(resolvedInitialId);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, resolvedInitialId]);

  const expandedStyle = useMemo(
    () => items.find((item) => item.id === expandedId) ?? items[0],
    [expandedId, items],
  );

  if (!open || !expandedStyle || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/74 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-7xl overflow-hidden rounded-[32px] border border-white/10 bg-[#07131d] shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-20 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-sm font-medium text-white transition hover:border-white/24 hover:bg-white/12"
        >
          Close
        </button>

        <div className="border-b border-white/10 px-6 pb-5 pt-6 md:px-8">
          <div className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
            All PathwayIQ styles
          </div>
          <div className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            Hover across the cards to preview each quiz type. The highlighted card shows the style
            name and core description directly on the artwork.
          </div>
        </div>

        <div className="px-4 pb-4 pt-6 md:px-6">
          <div className="overflow-x-auto pb-2">
            <div className="flex min-h-[25rem] items-center gap-2 md:gap-3">
              {items.map((style) => {
                const expanded = style.id === expandedId;

                return (
                  <button
                    key={style.id}
                    type="button"
                    onMouseEnter={() => setExpandedId(style.id)}
                    onFocus={() => setExpandedId(style.id)}
                    onClick={() => setExpandedId(style.id)}
                    className={[
                      "group relative shrink-0 overflow-hidden rounded-[28px] border border-white/10 transition-all duration-500 ease-out focus:outline-none focus:ring-2 focus:ring-cyan-300/50",
                      expanded ? "shadow-[0_22px_60px_rgba(15,23,42,0.45)]" : "shadow-[0_10px_36px_rgba(0,0,0,0.24)]",
                    ].join(" ")}
                    style={{
                      width: expanded ? "min(24rem, 42vw)" : "5.25rem",
                      height: "24rem",
                    }}
                  >
                    <div
                      className={[
                        "absolute inset-0",
                        style.surfaceClassName,
                        expanded ? "opacity-100" : "opacity-85",
                      ].join(" ")}
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.24),transparent_38%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.08),transparent_40%)]" />

                    <div className="relative h-full w-full p-3">
                      <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/10 bg-white/80">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.88),transparent_28%),radial-gradient(circle_at_80%_76%,rgba(255,255,255,0.24),transparent_36%)]" />
                        <div className="relative flex h-full items-center justify-center p-4">
                          <Image
                            src={style.illustrationSrc}
                            alt={style.label}
                            width={360}
                            height={360}
                            className={[
                              "h-auto w-full transition-transform duration-500",
                              expanded ? "max-w-[16rem] scale-100" : "max-w-[7rem] scale-95",
                            ].join(" ")}
                          />
                        </div>

                        <div
                          className={[
                            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/92 via-slate-900/70 to-transparent p-5 text-left transition-all duration-400",
                            expanded
                              ? "translate-y-0 opacity-100"
                              : "pointer-events-none translate-y-6 opacity-0",
                          ].join(" ")}
                        >
                          <div className={["text-2xl font-semibold", style.lightCardColorClassName].join(" ")}>
                            {style.label}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-100">{style.tagline}</p>
                        </div>

                        <div
                          className={[
                            "absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-slate-800/10 bg-slate-950/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white transition-all duration-300",
                            expanded ? "opacity-0" : "opacity-100",
                          ].join(" ")}
                        >
                          {style.label}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className={["text-2xl font-semibold", expandedStyle.colorClassName].join(" ")}>
                {expandedStyle.label}
              </div>
              <div className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                Style profile
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{expandedStyle.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {expandedStyle.workLikes.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-black/18 px-3 py-1 text-xs text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
