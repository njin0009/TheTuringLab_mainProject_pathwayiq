import { useEffect, useRef, useState } from "react";
import {
  CAREER_PROFILES,
  EXPLORE_AUTOCOMPLETE,
  INTEREST_TAGS,
  type CareerCard,
} from "@/lib/career-data";
import { ArrowRight, Search, TrendingUp } from "lucide-react";

interface ExploreSceneProps {
  careers: CareerCard[];
  searchQuery: string;
  activeInterest: string | null;
  onSearchChange: (value: string) => void;
  onSelectInterest: (value: string | null) => void;
  onOpenCareer: (careerId: CareerCard["id"]) => void;
  onCompare: () => void;
  onClearFilters: () => void;
}

const TRENDING_QUERIES = [
  { label: "Solar Systems Engineer", detail: "Industry: Renewable Energy" },
  { label: "Wind Turbine Technician", detail: "Industry: Renewable Energy" },
  { label: "Cybersecurity Analyst", detail: "Industry: Technology" },
] as const;

const PAGE_SIZE = 6;

function getRiskTone(percent: number) {
  if (percent >= 60) {
    return {
      toneClassName: "text-rose-300",
      barClassName: "bg-rose-400",
      edgeClassName: "before:bg-rose-300",
    };
  }

  if (percent >= 25) {
    return {
      toneClassName: "text-amber-300",
      barClassName: "bg-amber-400",
      edgeClassName: "before:bg-amber-300",
    };
  }

  return {
    toneClassName: "text-emerald-300",
    barClassName: "bg-emerald-400",
    edgeClassName: "before:bg-cyan-300",
  };
}

export default function ExploreScene({
  careers,
  searchQuery,
  activeInterest,
  onSearchChange,
  onSelectInterest,
  onOpenCareer,
  onCompare,
  onClearFilters,
}: ExploreSceneProps) {
  const blurTimeoutRef = useRef<number | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [page, setPage] = useState(1);
  const discoverQuery = searchQuery.trim() || TRENDING_QUERIES[0].label;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const totalPages = Math.max(1, Math.ceil(careers.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, careers.length);
  const pagedCareers = careers.slice(pageStart, pageEnd);
  const autocompleteItems = EXPLORE_AUTOCOMPLETE.filter((item) => {
    if (normalizedQuery.length === 0) {
      return true;
    }

    return (
      item.value.toLowerCase().includes(normalizedQuery) ||
      item.detail.toLowerCase().includes(normalizedQuery)
    );
  })
    .filter((item) => item.value.toLowerCase() !== normalizedQuery)
    .slice(0, 6);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeInterest]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <section className="relative h-screen w-screen shrink-0 overflow-y-auto px-6 pb-36 pt-24">
      <div className="mx-auto flex min-h-full max-w-[1320px] flex-col">
        <div className="relative z-10 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Explore Paths
          </div>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Explore your future path
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
            Cross-referenced career cards, pathway signals, and AI-risk context in one clear PathwayIQ flow.
          </p>
        </div>

        <div className="relative z-20 mt-6 rounded-[32px] border border-white/10 bg-[#08131f]/88 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row">
            <div
              data-prevent-walker="true"
              className="relative flex flex-1 items-center gap-4 rounded-[24px] border border-white/10 bg-black/20 px-5 py-4"
            >
              <Search className="h-5 w-5 text-cyan-300" />
              <input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                onFocus={() => {
                  if (blurTimeoutRef.current !== null) {
                    window.clearTimeout(blurTimeoutRef.current);
                  }
                  setIsSearchFocused(true);
                }}
                onBlur={() => {
                  blurTimeoutRef.current = window.setTimeout(() => {
                    setIsSearchFocused(false);
                  }, 120);
                }}
                placeholder="Search a role, pathway, or skill"
                className="w-full bg-transparent text-lg text-white outline-none placeholder:text-slate-500"
              />
              {isSearchFocused ? (
                <div className="absolute left-0 right-0 top-[calc(100%+14px)] z-[120] rounded-[24px] border border-white/10 bg-[#08131f]/96 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                  <div className="px-2 pb-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                    Autocomplete
                  </div>
                  <div className="space-y-2">
                    {autocompleteItems.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-white/10 px-4 py-3 text-sm text-slate-400">
                        No quick suggestions yet. Try broader words like renewable, nurse, cyber, or AI.
                      </div>
                    ) : (
                      autocompleteItems.map((item) => (
                        <button
                          key={`${item.category}-${item.value}`}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSearchChange(item.value);
                            setIsSearchFocused(false);
                          }}
                          className="flex w-full items-center justify-between rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition hover:border-cyan-300/26 hover:bg-white/[0.07]"
                        >
                          <div>
                            <div className="text-sm font-medium text-white">{item.value}</div>
                            <div className="mt-1 text-xs text-slate-400">{item.detail}</div>
                          </div>
                          <div className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200">
                            {item.category}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onSearchChange(discoverQuery)}
              className="rounded-[22px] bg-gradient-to-r from-cyan-500 to-orange-500 px-8 py-4 text-base font-semibold text-white shadow-[0_14px_34px_rgba(6,182,212,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_42px_rgba(249,115,22,0.26)]"
            >
              Discover
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
            {TRENDING_QUERIES.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onSearchChange(item.label)}
                className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:border-cyan-300/26 hover:bg-white/[0.07]"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-cyan-300" />
                  <div>
                    <div className="text-base font-medium text-white">{item.label}</div>
                    <div className="text-sm text-slate-400">{item.detail}</div>
                  </div>
                </div>
              </button>
            ))}
            <div className="flex items-center justify-end rounded-[22px] border border-white/10 bg-black/20 px-5 py-4 text-sm text-slate-300">
              Showing
              <span className="mx-1 font-semibold text-cyan-300">
                {careers.length === 0 ? 0 : pageStart + 1}-{pageEnd}
              </span>
              of
              <span className="mx-1 font-semibold text-cyan-300">{careers.length}</span>
              career paths matched
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
            {["renewable energy", "nurse", "cyber", "AI"].map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => onSearchChange(hint)}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 transition hover:border-cyan-300/26 hover:bg-white/[0.08]"
              >
                Try: {hint}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onSelectInterest(null)}
              className={[
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                activeInterest === null
                  ? "border-cyan-300/38 bg-cyan-400/16 text-cyan-50"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/22 hover:bg-white/[0.08]",
              ].join(" ")}
            >
              All Paths
            </button>
            {INTEREST_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSelectInterest(tag)}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  activeInterest === tag
                    ? "border-cyan-300/38 bg-cyan-400/16 text-cyan-50"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/22 hover:bg-white/[0.08]",
                ].join(" ")}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/22 hover:bg-white/[0.08]"
            >
              Clear filters
            </button>
            <button
              type="button"
              onClick={onCompare}
              className="rounded-full border border-orange-300/18 bg-orange-400/12 px-4 py-2 text-sm font-medium text-orange-50 transition hover:border-orange-300/32 hover:bg-orange-400/18"
            >
              Compare shortlisted roles
            </button>
          </div>
        </div>

        <div className="relative z-10 mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {careers.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-white/16 bg-white/[0.04] p-8 text-slate-300 lg:col-span-2 xl:col-span-3">
              No matching careers yet. Try clearing filters or searching with broader terms.
            </div>
          ) : (
            pagedCareers.map((career) => {
              const profile = CAREER_PROFILES[career.id];
              const [industry, signal = "Pathway"] = profile.badge.split("·").map((item) => item.trim());
              const pathway = profile.stats[0]?.val ?? "Pathway details coming soon";
              const risk = getRiskTone(profile.riskPercent);

              return (
                <article
                  key={career.id}
                  className={[
                    "relative overflow-hidden rounded-[30px] border border-white/10 bg-[#08131f]/92 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)] before:absolute before:bottom-4 before:left-0 before:top-4 before:w-[3px] before:rounded-full",
                    risk.edgeClassName,
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-wrap gap-3">
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200">
                        {industry}
                      </span>
                      <span className="rounded-full border border-emerald-300/18 bg-emerald-400/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                        {signal}
                      </span>
                    </div>
                    <div className="text-3xl">{career.icon}</div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-3xl font-semibold tracking-tight text-white">
                      {career.title}
                    </h3>
                    <div className="mt-4 text-lg text-cyan-200">
                      payments <span className="ml-2 font-medium text-white">{profile.salary}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{profile.source}</div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>AI Displacement Risk</span>
                      <span className={["font-medium", risk.toneClassName].join(" ")}>
                        {profile.riskLabel}
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/8">
                      <div
                        className={["h-full rounded-full", risk.barClassName].join(" ")}
                        style={{ width: `${profile.riskPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 border-t border-white/8 pt-5">
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                      Pathway
                    </div>
                    <div className="mt-2 text-base text-slate-200">{pathway}</div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-4">
                    <p className="max-w-md text-sm leading-7 text-slate-300">{career.teaser}</p>
                    <button
                      type="button"
                      onClick={() => onOpenCareer(career.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:border-cyan-300/34 hover:bg-cyan-400/16"
                    >
                      View Details
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {careers.length > PAGE_SIZE ? (
          <div className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-[#08131f]/70 px-5 py-4 backdrop-blur-xl">
            <div className="text-sm text-slate-400">
              Page <span className="font-semibold text-white">{page}</span> of{" "}
              <span className="font-semibold text-white">{totalPages}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={[
                    "h-10 min-w-10 rounded-full border px-3 text-sm transition",
                    pageNumber === page
                      ? "border-cyan-300/38 bg-cyan-400/16 text-cyan-50"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25 hover:bg-white/[0.08]",
                  ].join(" ")}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        <div className="relative z-10 mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[26px] border border-white/10 bg-black/20 px-5 py-4 text-sm text-slate-300">
          <div>
            <div className="text-base font-semibold text-white">PathwayIQ Explore</div>
            <div className="mt-1 text-slate-400">
              Data cross-referenced from JSA, DESE, NCVER, and OECD style pathway sources.
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-slate-400">
            <span>Privacy</span>
            <span>Methodology</span>
            <span>Support</span>
          </div>
        </div>
      </div>
    </section>
  );
}
