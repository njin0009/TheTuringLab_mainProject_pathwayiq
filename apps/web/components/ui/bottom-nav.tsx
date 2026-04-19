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
    <nav className="fixed inset-x-0 bottom-0 z-[200] flex h-[4.6rem] items-end justify-center gap-2.5 border-t border-white/8 bg-[rgba(4,8,18,0.92)] px-4 pb-2">
      {NAV_ITEMS.map(({ label, idx }) => {
        const isActive = idx === activeIdx;

        return (
          <button
            key={idx}
            data-nav-item={idx}
            type="button"
            onClick={() => onNavigate?.(idx)}
            className={`relative inline-flex h-10 min-w-[8.4rem] items-center justify-center rounded-full border px-5 text-[15px] font-semibold tracking-[0.01em] transition-all duration-300 ${
              isActive
                ? "border-cyan-100/75 bg-[linear-gradient(180deg,rgba(56,189,248,0.34),rgba(15,23,42,0.96))] text-white shadow-[0_10px_24px_rgba(34,211,238,0.2)] ring-1 ring-cyan-300/35"
                : "border-white/10 bg-[rgba(2,6,23,0.68)] text-slate-200 hover:border-white/16 hover:bg-[rgba(8,15,32,0.84)] hover:text-white"
            }`}
          >
            <span className={`relative z-10 ${isActive ? "drop-shadow-[0_1px_8px_rgba(255,255,255,0.16)]" : ""}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
