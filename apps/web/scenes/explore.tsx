import type { CareerCard } from "@/lib/career-data";

interface ExploreSceneProps {
  careers: CareerCard[];
  searchQuery: string;
  activeInterest: string | null;
  onOpenCareer: (careerId: CareerCard["id"]) => void;
  onCompare: () => void;
  onClearFilters: () => void;
}

export default function ExploreScene({
  careers,
  searchQuery,
  activeInterest,
  onOpenCareer,
  onCompare,
  onClearFilters,
}: ExploreSceneProps) {
  return (
    <section className="relative h-screen w-screen shrink-0 snap-start px-6 pb-36 pt-28">
      <div className="mx-auto grid h-full max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#57b6ff]">
            Scene 03
          </div>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Explore career cards without digging through one long document.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-300 md:text-lg">
            Search and interest filters now live in one predictable flow. Each result card can open details or jump into compare.
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-200">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              {careers.length} results
            </span>
            {searchQuery ? (
              <span className="rounded-full border border-[#57b6ff]/35 bg-[#57b6ff]/10 px-4 py-2">
                Search: {searchQuery}
              </span>
            ) : null}
            {activeInterest ? (
              <span className="rounded-full border border-[#00c46a]/35 bg-[#00c46a]/10 px-4 py-2">
                Filter: {activeInterest}
              </span>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onCompare}
              className="rounded-2xl bg-[#00c46a] px-6 py-3 font-semibold text-[#04130b] transition hover:translate-y-[-1px] hover:bg-[#18db7f]"
            >
              Compare shortlisted roles {"->"}
            </button>
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-2xl border border-white/10 px-6 py-3 text-slate-200 transition hover:border-white/25 hover:bg-white/5"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {careers.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 p-8 text-slate-300">
              No matching careers yet. Try clearing filters or searching with broader terms.
            </div>
          ) : (
            careers.map((career) => (
              <button
                key={career.id}
                type="button"
                onClick={() => onOpenCareer(career.id)}
                className="rounded-[24px] border border-white/10 bg-white/[0.06] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition hover:translate-x-[-2px] hover:border-[#00c46a]/55 hover:bg-[#00c46a]/[0.08]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00c46a]/16 text-2xl">
                    {career.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-xl font-semibold text-white">{career.title}</div>
                      <span className="rounded-full bg-[#00c46a]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8ff7c1]">
                        {career.tag}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-400">{career.meta}</div>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{career.teaser}</p>
                    <div className="mt-4 text-sm font-medium text-[#8ff7c1]">Open details {"->"}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
