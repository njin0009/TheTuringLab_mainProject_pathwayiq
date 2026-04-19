"use client";

import { forwardRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

export interface PathwayWalkerVariant {
  src: string;
  width: number;
  height: number;
  className?: string;
  mirroredByDefault?: boolean;
}

interface PathwayWalkerProps {
  variant: PathwayWalkerVariant;
  bubble?: {
    id: number;
    text: string;
    current: number;
    total: number;
  } | null;
  onTalk?: () => void;
  onBubblePrev?: () => void;
  onBubbleNext?: () => void;
  onBubbleClose?: () => void;
}

export const PathwayWalker = forwardRef<HTMLDivElement, PathwayWalkerProps>(
  function PathwayWalker(
    { variant, bubble = null, onTalk, onBubblePrev, onBubbleNext, onBubbleClose },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className="pathway-walker walker-idle fixed bottom-[calc(7rem+6px)] left-1/2 z-[195] hidden -translate-x-1/2 md:block"
        aria-hidden={onTalk ? undefined : true}
      >
        <AnimatePresence mode="wait">
          {bubble ? (
            <motion.div
              key={bubble.id}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute bottom-[calc(100%+1.2rem)] left-1/2 z-[2] w-max max-w-[26rem] -translate-x-1/2"
            >
              <div className="pointer-events-auto rounded-[22px] border border-slate-200/90 bg-white px-6 py-4 shadow-[0_20px_48px_rgba(0,0,0,0.18)]">
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onBubbleClose}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                    aria-label="Close guide message"
                  >
                    ×
                  </button>
                </div>
                <div className="text-center text-[17px] font-semibold leading-8 text-slate-950">
                  {bubble.text}
                </div>
                <div className="mt-3 flex items-center justify-center gap-2.5 text-slate-500">
                  <button
                    type="button"
                    onClick={onBubblePrev}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                    aria-label="Show previous guide message"
                  >
                    ‹
                  </button>
                  <div className="min-w-[3.4rem] text-center text-[12px] font-semibold tracking-[0.18em] text-slate-400">
                    {bubble.current}/{bubble.total}
                  </div>
                  <button
                    type="button"
                    onClick={onBubbleNext}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                    aria-label="Show next guide message"
                  >
                    ›
                  </button>
                </div>
              </div>
              <div className="mx-auto -mt-px h-3.5 w-3.5 rotate-45 border-b border-r border-slate-200/90 bg-white" />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="walker-shadow" />
        <div className="walker-art">
          <motion.button
            type="button"
            onClick={onTalk}
            className="walker-shell pointer-events-auto cursor-pointer bg-transparent p-0 outline-none"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            whileTap={onTalk ? { scale: 0.98, y: 1 } : undefined}
            aria-label="Talk to guide"
          >
            <div
              className="walker-flip"
              data-default-scale={variant.mirroredByDefault ? "-1" : "1"}
              style={{ transform: `scaleX(${variant.mirroredByDefault ? -1 : 1})` }}
            >
              <Image
                src={variant.src}
                alt=""
                width={variant.width}
                height={variant.height}
                className={
                  variant.className ??
                  "h-[150px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.28)]"
                }
              />
            </div>
          </motion.button>
        </div>
      </div>
    );
  },
);
