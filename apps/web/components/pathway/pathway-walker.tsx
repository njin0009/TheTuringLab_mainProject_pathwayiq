"use client";

import { forwardRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

export interface PathwayWalkerVariant {
  src: string;
  width: number;
  height: number;
  className?: string;
  mirroredByDefault?: boolean;
}

interface PathwayWalkerProps {
  variant: PathwayWalkerVariant;
}

export const PathwayWalker = forwardRef<HTMLDivElement, PathwayWalkerProps>(
  function PathwayWalker({ variant }, ref) {
    return (
      <div
        ref={ref}
        className="pathway-walker walker-idle pointer-events-none fixed bottom-[calc(7rem-6px)] left-1/2 z-[195] hidden -translate-x-1/2 md:block"
        aria-hidden="true"
      >
        <div className="walker-shadow" />
        <div className="walker-art">
          <motion.div
            key={variant.src}
            className="walker-shell"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
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
                  "h-[136px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.28)]"
                }
              />
            </div>
          </motion.div>
        </div>
      </div>
    );
  },
);
