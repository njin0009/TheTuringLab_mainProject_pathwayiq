"use client";

import * as React from "react";
import { motion, type PanInfo } from "framer-motion";

type CardPosition = "front" | "middle" | "back";

export interface PathChoiceItem {
  id: string;
  title: string;
  description: string;
  accentClassName: string;
  eyebrow: string;
  onSelect: () => void;
}

interface TestimonialCardProps {
  handleShuffle: () => void;
  item: PathChoiceItem;
  position: CardPosition;
}

export function TestimonialCard({
  handleShuffle,
  item,
  position,
}: TestimonialCardProps) {
  const dragRef = React.useRef(0);
  const isFront = position === "front";

  return (
    <motion.div
      style={{
        zIndex: position === "front" ? "3" : position === "middle" ? "2" : "1",
      }}
      animate={{
        rotate: position === "front" ? "-6deg" : position === "middle" ? "0deg" : "6deg",
        x: position === "front" ? "0%" : position === "middle" ? "34%" : "68%",
        y: position === "front" ? "0%" : position === "middle" ? "3%" : "7%",
        scale: position === "front" ? 1 : position === "middle" ? 0.96 : 0.92,
      }}
      drag={true}
      dragElastic={0.35}
      dragListener={isFront}
      dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
      onDragStart={(_, info: PanInfo) => {
        dragRef.current = info.point.x;
      }}
      onDragEnd={(_, info: PanInfo) => {
        if (dragRef.current - info.point.x > 150) {
          handleShuffle();
        }
        dragRef.current = 0;
      }}
      transition={{ duration: 0.35 }}
      className={[
        "absolute left-0 top-0 grid h-[392px] w-[310px] select-none rounded-[28px] border-2 border-slate-700 bg-slate-900/28 p-6 shadow-xl backdrop-blur-md",
        isFront ? "cursor-grab active:cursor-grabbing" : "",
      ].join(" ")}
    >
      <div className="flex h-full flex-col justify-between">
        <div>
          <div
            className={[
              "inline-flex rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/82",
              item.accentClassName,
            ].join(" ")}
          >
            {item.eyebrow}
          </div>
          <div className="mt-6 text-3xl font-semibold leading-tight text-white">
            {item.title}
          </div>
          <p className="mt-4 text-base leading-7 text-slate-300">{item.description}</p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={item.onSelect}
            className="w-full rounded-2xl border border-white/12 bg-white/[0.06] px-5 py-3 text-left text-sm font-medium text-white transition hover:border-white/22 hover:bg-white/[0.1]"
          >
            Open {item.title}
          </button>
          {isFront ? (
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Drag left to reshuffle
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

interface PathChoiceDeckProps {
  items: PathChoiceItem[];
}

export function PathChoiceDeck({ items }: PathChoiceDeckProps) {
  const [positions, setPositions] = React.useState<CardPosition[]>([
    "front",
    "middle",
    "back",
  ]);

  const handleShuffle = React.useCallback(() => {
    setPositions((current) => {
      const next = [...current];
      const last = next.pop();
      if (last) {
        next.unshift(last);
      }
      return next as CardPosition[];
    });
  }, []);

  return (
    <div className="grid place-content-center overflow-hidden px-8 py-6 text-slate-50">
      <div className="relative -ml-[76px] h-[392px] w-[310px] md:-ml-[150px]">
        {items.map((item, index) => (
          <TestimonialCard
            key={item.id}
            item={item}
            handleShuffle={handleShuffle}
            position={positions[index]}
          />
        ))}
      </div>
    </div>
  );
}
