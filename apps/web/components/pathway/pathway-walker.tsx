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
              className="pointer-events-none absolute bottom-[calc(100%+1.15rem)] left-1/2 z-[2] w-max max-w-[20rem] -translate-x-1/2"
            >
              <div className="rounded-2xl border border-white/14 bg-[rgba(7,12,24,0.9)] px-5 py-3.5 text-center text-[15px] font-medium leading-7 text-white shadow-[0_18px_44px_rgba(0,0,0,0.3)] backdrop-blur-md">
                {bubble.text}
              </div>
              <div className="mx-auto -mt-px h-3 w-3 rotate-45 border-b border-r border-white/14 bg-[rgba(7,12,24,0.9)]" />
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
