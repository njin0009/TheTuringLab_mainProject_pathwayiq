import { CAREER_CARDS, CAREER_PROFILES, type CareerId } from "@/lib/career-data";

interface CompareSceneProps {
  selectedCareerIds: CareerId[];
  onToggleCareer: (careerId: CareerId) => void;
  onOpenCareer: (careerId: CareerId) => void;
  onReport: () => void;
}

export default function CompareScene({
  selectedCareerIds,
  onToggleCareer,
  onOpenCareer,
  onReport,
}: CompareSceneProps) {
  const selectedCareers = selectedCareerIds.map((careerId) => CAREER_PROFILES[careerId]);

  return (
    <section className="relative h-screen w-screen shrink-0 snap-start px-6 pb-36 pt-28">
      <div className="mx-auto grid h-full max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#7dd3fc]">
            Scene 04
          </div>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Hold two options side by side and look at the trade-offs.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-300 md:text-lg">
            Compare is now its own scene module instead of inline click handlers scattered through HTML. You can keep it lightweight today and still connect real API data later.
          </p>
          <button
            type="button"
            onClick={onReport}
            className="mt-8 rounded-2xl bg-[#57b6ff] px-6 py-3 font-semibold text-[#02121f] transition hover:translate-y-[-1px] hover:bg-[#7cc8ff]"
          >
            Generate report view {"->"}
          </button>
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {CAREER_CARDS.map((career) => {
              const selected = selectedCareerIds.includes(career.id);
              return (
                <button
                  key={career.id}
                  type="button"
                  onClick={() => onToggleCareer(career.id)}
                  aria-pressed={selected}
                  className={[
                    "rounded-[24px] border p-5 text-left transition",
                    selected
                      ? "border-[#57b6ff] bg-[#57b6ff]/[0.14] text-white"
                      : "border-white/10 bg-white/[0.06] text-slate-200 hover:border-[#57b6ff]/55 hover:bg-[#57b6ff]/[0.08]",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{career.icon}</div>
                    <div>
                      <div className="text-lg font-semibold">{career.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{career.meta}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {selectedCareers.map((career) => (
              <div key={career.id} className="rounded-[28px] border border-white/10 bg-white/[0.07] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-[0.24em] text-[#7dd3fc]">{career.badge}</div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {career.icon} {career.title}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCareer(career.id)}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-white/30 hover:bg-white/5"
                  >
                    Details
                  </button>
                </div>
                <div className="mt-4 text-3xl font-semibold text-[#8dd2ff]">{career.salary}</div>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div>{career.stats[1].lbl}: {career.stats[1].val}</div>
                  <div>{career.stats[2].lbl}: {career.stats[2].val}</div>
                  <div>{career.stats[3].lbl}: {career.stats[3].val}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
