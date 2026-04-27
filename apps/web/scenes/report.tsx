import { CAREER_PROFILES, type CareerId } from "@/lib/career-data";

interface ReportSceneProps {
  careerId: CareerId;
  onOpenCareer: (careerId: CareerId) => void;
  onCompare: () => void;
  onRestart: () => void;
}

export default function ReportScene({
  careerId,
  onOpenCareer,
  onCompare,
  onRestart,
}: ReportSceneProps) {
  const career = CAREER_PROFILES[careerId];

  return (
    <section className="relative h-screen w-screen shrink-0 snap-start overflow-hidden px-6 pb-36 pt-28">
      <div className="mx-auto grid min-h-full max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#a5b4fc]">
            Scene 05
          </div>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Turn the shortlist into a report-ready recommendation card.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            This scene is now isolated from the rest of the experience, so later you can swap static data for real student results or backend responses without rewriting the page shell.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => onOpenCareer(career.id)}
              className="rounded-2xl bg-[#00c46a] px-6 py-3 font-semibold text-[#04130b] transition hover:translate-y-[-1px] hover:bg-[#18db7f]"
            >
              Open full profile {"->"}
            </button>
            <button
              type="button"
              onClick={onCompare}
              className="rounded-2xl border border-white/10 px-6 py-3 text-slate-200 transition hover:border-white/25 hover:bg-white/5"
            >
              Back to compare
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="rounded-2xl border border-[#a5b4fc]/30 px-6 py-3 text-[#d6dcff] transition hover:border-[#a5b4fc]/60 hover:bg-[#a5b4fc]/10"
            >
              Restart journey
            </button>
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.07] p-7 shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-xl">
          <div className="flex items-center gap-4 border-b border-white/10 pb-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#00c46a]/16 text-3xl">
              {career.icon}
            </div>
            <div>
              <div className="text-2xl font-semibold text-white">{career.title}</div>
              <div className="mt-1 text-sm uppercase tracking-[0.18em] text-[#8ff7c1]">
                {career.badge}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {career.stats.map((stat) => (
              <div key={stat.lbl} className="rounded-2xl bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{stat.lbl}</div>
                <div className="mt-2 text-base leading-7 text-white">{stat.val}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-[#0d1930] p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Why it stands out</div>
            <p className="mt-3 text-base leading-8 text-slate-200">{career.summary}</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#4c6fff] via-[#57b6ff] to-[#00c46a]" />
            </div>
            <div className="mt-3 text-sm text-slate-400">
              Confidence preview based on current interests, search terms, and shortlist choices.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
