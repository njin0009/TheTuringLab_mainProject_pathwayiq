"use client";

import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";

const NAV_ITEMS = [
  { label: "Home", idx: 0 },
  { label: "Quiz", idx: 1 },
  { label: "Explore", idx: 2 },
  { label: "Compare", idx: 3 },
  { label: "Report", idx: 4 },
];

interface BottomNavProps {
  activeIdx?: number;
  onNavigate?: (idx: number) => void;
}

export function BottomNav({ activeIdx = 0, onNavigate }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[200] flex h-[5.75rem] items-end justify-center gap-3 border-t border-white/8 bg-[rgba(4,8,18,0.97)] px-6 pb-3 backdrop-blur-[28px]"
    >
      {NAV_ITEMS.map(({ label, idx }) => (
        <div key={idx} data-nav-item={idx} className="relative">
          <LiquidMetalButton
            label={label}
            active={idx === activeIdx}
            onClick={() => onNavigate?.(idx)}
          />
        </div>
      ))}
    </nav>
  );
}
