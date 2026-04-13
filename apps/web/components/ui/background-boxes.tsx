"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface BoxesProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  rowCount?: number;
  colCount?: number;
}

const COLORS = [
  "rgb(254 240 138)",
  "rgb(253 224 71)",
  "rgb(252 211 77)",
  "rgb(253 186 116)",
  "rgb(251 146 60)",
  "rgb(249 115 22)",
  "rgb(252 165 165)",
  "rgb(248 113 113)",
  "rgb(251 191 36)",
] as const;

export const BoxesCore = ({
  className,
  rowCount = 34,
  colCount = 18,
  ...rest
}: BoxesProps) => {
  const rows = useMemo(() => Array.from({ length: rowCount }, (_, index) => index), [rowCount]);
  const cols = useMemo(() => Array.from({ length: colCount }, (_, index) => index), [colCount]);

  const getCellColor = (row: number, col: number) => COLORS[(row * 7 + col * 13) % COLORS.length];

  return (
    <div
      style={{
        transform:
          "translate(-40%,-60%) skewX(-48deg) skewY(14deg) scale(0.675) rotate(0deg) translateZ(0)",
      }}
      className={cn(
        "absolute left-1/4 -top-1/4 z-0 flex h-full w-full -translate-x-1/2 -translate-y-1/2 p-4",
        className,
      )}
      {...rest}
    >
      {rows.map((row) => (
        <motion.div
          key={`row-${row}`}
          className="relative h-8 w-16 border-l border-orange-200/15"
        >
          {cols.map((col) => (
            <motion.div
              key={`col-${row}-${col}`}
              whileHover={{
                backgroundColor: getCellColor(row, col),
                transition: { duration: 0 },
              }}
              animate={{
                transition: { duration: 2 },
              }}
              className="relative h-8 w-16 border-r border-t border-orange-200/15"
            >
              {col % 2 === 0 && row % 2 === 0 ? (
                <Plus className="pointer-events-none absolute -left-[22px] -top-[14px] h-6 w-10 text-orange-100/18 stroke-[1px]" />
              ) : null}
            </motion.div>
          ))}
        </motion.div>
      ))}
    </div>
  );
};

export const Boxes = React.memo(BoxesCore);
