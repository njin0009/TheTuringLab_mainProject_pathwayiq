"use client";

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
    <nav className="fixed inset-x-0 bottom-0 z-[200] flex h-[4.5rem] items-end justify-center gap-2 border-t border-white/8 bg-[rgba(4,8,18,0.92)] px-4 pb-2">
      {NAV_ITEMS.map(({ label, idx }) => {
        const isActive = idx === activeIdx;

        return (
          <button
            key={idx}
            data-nav-item={idx}
            type="button"
            onClick={() => onNavigate?.(idx)}
            className={`relative inline-flex h-10 min-w-[8rem] items-center justify-center rounded-full border px-5 text-sm font-medium transition-all duration-300 ${
              isActive
                ? "border-cyan-200/40 bg-[linear-gradient(180deg,rgba(125,211,252,0.15),rgba(15,23,42,0.88))] text-white shadow-[0_8px_20px_rgba(125,211,252,0.1)]"
                : "border-white/10 bg-[rgba(2,6,23,0.68)] text-slate-300 hover:border-white/16 hover:bg-[rgba(8,15,32,0.84)] hover:text-white"
            }`}
          >
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
