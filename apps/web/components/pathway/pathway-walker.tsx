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
}

export const PathwayWalker = forwardRef<HTMLDivElement, PathwayWalkerProps>(
  function PathwayWalker({ variant, bubble = null, onTalk }, ref) {
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
              className="pointer-events-none absolute bottom-[calc(100%+1.2rem)] left-1/2 z-[2] w-max max-w-[24rem] -translate-x-1/2"
            >
              <div className="rounded-[22px] border border-slate-200/90 bg-white px-6 py-4 shadow-[0_20px_48px_rgba(0,0,0,0.18)]">
                <div className="text-center text-[17px] font-semibold leading-8 text-slate-950">
                  {bubble.text}
                </div>
                <div className="mt-2 text-right text-[12px] font-semibold tracking-[0.18em] text-slate-400">
                  {bubble.current}/{bubble.total}
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
