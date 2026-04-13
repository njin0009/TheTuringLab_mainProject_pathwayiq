import { QUIZ_OPTIONS } from "@/lib/career-data";

interface QuizSceneProps {
  selectedOption: string;
  onSelectOption: (option: string) => void;
  onExplore: () => void;
}

export default function QuizScene({
  selectedOption,
  onSelectOption,
  onExplore,
}: QuizSceneProps) {
  return (
    <section className="relative h-screen w-screen shrink-0 snap-start overflow-y-auto px-6 pb-36 pt-28">
      <div className="mx-auto grid min-h-full max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#00c46a]">
            Scene 02
          </div>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Turn one instinct into a better starting direction.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            The original prototype used inline buttons and stateful DOM updates. This scene now keeps quiz state in a dedicated hook, so the UI and the logic are easier to trace.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onExplore}
              className="rounded-2xl bg-[#00c46a] px-6 py-3 font-semibold text-[#04130b] transition hover:translate-y-[-1px] hover:bg-[#18db7f]"
            >
              See matched careers {"->"}
            </button>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-300">
              Your selection will also seed the Explore filters.
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.07] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#00c46a]">
            Quick Preference Check
          </div>
          <div className="mt-4 text-2xl font-semibold leading-tight text-white md:text-3xl">
            Which of these feels most energising right now?
          </div>
          <div className="mt-6 flex flex-col gap-3">
            {QUIZ_OPTIONS.map((option) => {
              const selected = selectedOption === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onSelectOption(option)}
                  className={[
                    "rounded-2xl border px-5 py-4 text-left text-base transition",
                    selected
                      ? "border-[#00c46a] bg-[#00c46a]/18 text-white"
                      : "border-white/10 bg-white/5 text-slate-200 hover:border-[#00c46a]/60 hover:bg-[#00c46a]/10",
                  ].join(" ")}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
