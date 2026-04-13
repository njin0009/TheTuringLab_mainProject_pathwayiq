import { CAREER_PROFILES, type CareerId } from "@/lib/career-data";
import { cn } from "@/lib/utils";

interface CareerOverlayProps {
  careerId: CareerId | null;
  onClose: () => void;
  onGoToCompare: () => void;
  onGoToReport: () => void;
}

export function CareerOverlay({
  careerId,
  onClose,
  onGoToCompare,
  onGoToReport,
}: CareerOverlayProps) {
  if (!careerId) {
    return null;
  }

  const career = CAREER_PROFILES[careerId];

  return (
    <div
      className={cn(
        "fixed inset-0 z-[300] flex items-center justify-center bg-[#05101d]/84 px-4 py-8 backdrop-blur-md",
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="career-overlay-title"
    >
      <div className="relative w-full max-w-4xl rounded-[32px] border border-white/10 bg-[#0c1830] p-7 shadow-[0_28px_90px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-xl text-slate-200 transition hover:bg-white/[0.16]"
          aria-label="Close career details"
        >
          x
        </button>

        <div className="inline-flex rounded-full bg-[#00c46a]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8ff7c1]">
          {career.badge}
        </div>
        <h3 id="career-overlay-title" className="mt-5 text-4xl font-semibold text-white md:text-5xl">
          {career.icon} {career.title}
        </h3>
        <div className="mt-3 text-3xl font-semibold text-[#8dd2ff]">{career.salary}</div>
        <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">{career.summary}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {career.stats.map((stat) => (
            <div key={stat.lbl} className="rounded-2xl bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{stat.lbl}</div>
              <div className="mt-2 text-base leading-7 text-white">{stat.val}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={onGoToReport}
            className="rounded-2xl bg-[#00c46a] px-6 py-3 font-semibold text-[#04130b] transition hover:translate-y-[-1px] hover:bg-[#18db7f]"
          >
            Open report view {"->"}
          </button>
          <button
            type="button"
            onClick={onGoToCompare}
            className="rounded-2xl border border-white/10 px-6 py-3 text-slate-200 transition hover:border-white/25 hover:bg-white/5"
          >
            Compare this career
          </button>
        </div>
      </div>
    </div>
  );
}
