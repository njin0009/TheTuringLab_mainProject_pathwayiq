import { useEffect, useMemo, useRef, useState } from "react";
import { CAREER_CARDS, INTEREST_TAGS, type CareerCard, type CareerId } from "@/lib/career-data";
import { Search, TrendingUp } from "lucide-react";
import CourseDesignCard, { type CourseDesignCardData } from "@/components/ui/course-design-cards";
import { searchCareers, type BackendCareerRecord } from "@/lib/api-client";
import { EXPLORE_TRENDING_QUERIES } from "@/lib/explore-trends";
import { QUIZ_DIMENSIONS, type QuizDimensionId } from "@/lib/quiz-data";
import type { ReportCareerSnapshot } from "@/lib/report-career";
import careerCardsData from "../public/data2/career-cards.json";

interface ExploreSceneProps {
  careers: CareerCard[];
  searchQuery: string;
  searchLaunchKey: number;
  activeInterest: string | null;
  onSearchChange: (value: string) => void;
  onSelectInterest: (value: string | null) => void;
  onOpenCareer: (careerId: CareerCard["id"]) => void;
  onOpenReport: (career: ReportCareerSnapshot) => void;
  onCompare: () => void;
  onClearFilters: () => void;
}

interface ExploreCareerRecord {
  title: string;
  pathway: string;
  industry: string;
  anzsco_code: string;
  median_salary: number;
  shortage_status: string;
  ai_risk?: string; // "Low" | "Medium" | "High" when sourced from backend
}

interface ExploreAutocompleteItem {
  value: string;
  detail: string;
  category: "career" | "industry" | "pathway";
}

interface AutomationLevelTone {
  label: "Low change" | "Some change" | "Big change";
  toneClassName: string;
  pillClassName: string;
  edgeClassName: string;
}

const DATA2_CAREERS = careerCardsData as ExploreCareerRecord[];
const QUICK_HINTS = ["healthcare", "engineering", "business"] as const;
const PAGE_SIZE = 6;
const DATA2_BY_CODE = new Map(DATA2_CAREERS.map((career) => [career.anzsco_code, career]));
const DATA2_BY_TITLE = new Map(DATA2_CAREERS.map((career) => [career.title.toLowerCase(), career]));
const REPORT_CAREER_BY_DATA2_TITLE: Record<string, CareerId> = {
  "software engineer": "career-ds",
  "registered nurse (medical practice)": "career-nurse",
  "electrician (general)": "career-elec",
  "security consultant": "career-cyber",
  "electrical engineering technician": "career-solar",
  "telecommunications technician": "career-wind",
  "therapy aide": "career-physio",
  "graphic designer": "career-ux",
  "developer programmer": "career-prompt",
  "transport company manager": "career-freight",
  "data entry operator": "career-data-entry",
};

const FALLBACK_REPORT_BY_STYLE: Record<QuizDimensionId, CareerId> = {
  builder: "career-solar",
  decoder: "career-ds",
  creator: "career-ux",
  guide: "career-nurse",
  catalyst: "career-cyber",
  strategist: "career-freight",
};

const INTEREST_MATCHERS: Record<(typeof INTEREST_TAGS)[number], (career: ExploreCareerRecord) => boolean> = {
  "Data & AI": (career) =>
    ["Business", "Technology", "Education"].includes(career.industry) ||
    /data|analyst|software|developer|programmer|telecommunications|network|digital/i.test(career.title),
  Healthcare: (career) =>
    ["Healthcare", "Community Services"].includes(career.industry),
  "Hands-on Trades": (career) =>
    career.pathway === "Apprenticeship" ||
    ["Construction", "Engineering", "Agriculture & Environment"].includes(career.industry),
  Cybersecurity: (career) =>
    ["Technology", "Business"].includes(career.industry) ||
    /cyber|security|network|telecommunications|cabler|systems/i.test(career.title),
  "Creative Problem Solving": (career) =>
    ["Engineering", "Education", "Construction", "Business"].includes(career.industry) ||
    /designer|architect|draftsperson|engineer|manager/i.test(career.title),
};

const STYLE_RULES: Record<
  QuizDimensionId,
  {
    industries: string[];
    pathways: string[];
    titleKeywords: string[];
  }
> = {
  builder: {
    industries: ["Engineering", "Construction", "Agriculture & Environment"],
    pathways: ["Apprenticeship", "TAFE"],
    titleKeywords: ["electrician", "plumber", "carpenter", "mechanic", "technician", "maintenance", "engineer"],
  },
  decoder: {
    industries: ["Technology", "Science", "Business"],
    pathways: ["TAFE"],
    titleKeywords: ["analyst", "developer", "software", "programmer", "data", "security", "consultant"],
  },
  creator: {
    industries: ["Creative Industries", "Technology", "Education"],
    pathways: ["TAFE"],
    titleKeywords: ["designer", "graphic", "interior", "draftsperson", "marketing", "creative"],
  },
  guide: {
    industries: ["Healthcare", "Community Services", "Education"],
    pathways: ["TAFE"],
    titleKeywords: ["nurse", "therapy", "health", "care", "social", "community", "teacher", "support"],
  },
  catalyst: {
    industries: ["Business", "Technology", "Engineering", "Construction"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: ["manager", "project", "sales", "lead", "executive", "transport", "security"],
  },
  strategist: {
    industries: ["Business", "Education", "Technology", "Engineering", "Community Services"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: ["manager", "planning", "policy", "project", "administrator", "coordinator", "operator"],
  },
};

const autocompleteMap = new Map<string, ExploreAutocompleteItem>();

for (const career of DATA2_CAREERS) {
  autocompleteMap.set(`career:${career.title}`, {
    value: career.title,
    detail: `Career · ${career.industry}`,
    category: "career",
  });

  if (!autocompleteMap.has(`industry:${career.industry}`)) {
    autocompleteMap.set(`industry:${career.industry}`, {
      value: career.industry,
      detail: "Industry",
      category: "industry",
    });
  }

  if (!autocompleteMap.has(`pathway:${career.pathway}`)) {
    autocompleteMap.set(`pathway:${career.pathway}`, {
      value: career.pathway,
      detail: "Pathway",
      category: "pathway",
    });
  }
}

const EXPLORE_AUTOCOMPLETE = Array.from(autocompleteMap.values());

function fromBackendRecord(record: BackendCareerRecord): ExploreCareerRecord {
  return {
    ...record,
    median_salary: Number.parseInt(record.median_salary, 10) || 0,
  };
}

function formatSalary(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getShortageLabel(status: string) {
  if (/shortage/i.test(status)) {
    return "Shortage";
  }

  return "Stable";
}

function getAutomationLevel(career: ExploreCareerRecord): AutomationLevelTone {
  // Use backend pre-computed value when available
  if (career.ai_risk === "Low") {
    return {
      label: "Low change",
      toneClassName: "text-emerald-300",
      pillClassName: "border-emerald-300/18 bg-emerald-400/12 text-emerald-200",
      edgeClassName: "before:bg-cyan-300",
    };
  }
  if (career.ai_risk === "High") {
    return {
      label: "Big change",
      toneClassName: "text-rose-300",
      pillClassName: "border-rose-300/18 bg-rose-400/12 text-rose-200",
      edgeClassName: "before:bg-rose-300",
    };
  }
  if (career.ai_risk === "Medium") {
    return {
      label: "Some change",
      toneClassName: "text-amber-300",
      pillClassName: "border-amber-300/18 bg-amber-400/12 text-amber-100",
      edgeClassName: "before:bg-amber-300",
    };
  }

  // Fallback: keyword inference for local JSON records (no ai_risk field)
  const title = career.title.toLowerCase();
  if (
    ["Healthcare", "Community Services", "Construction", "Engineering", "Agriculture & Environment"].includes(
      career.industry,
    ) ||
    career.pathway === "Apprenticeship"
  ) {
    return {
      label: "Low change",
      toneClassName: "text-emerald-300",
      pillClassName: "border-emerald-300/18 bg-emerald-400/12 text-emerald-200",
      edgeClassName: "before:bg-cyan-300",
    };
  }
  if (/clerk|attendant|barista|bookkeeper|cashier|reception|entry|retail|waiter|worker|assistant/i.test(title)) {
    return {
      label: "Big change",
      toneClassName: "text-rose-300",
      pillClassName: "border-rose-300/18 bg-rose-400/12 text-rose-200",
      edgeClassName: "before:bg-rose-300",
    };
  }
  return {
    label: "Some change",
    toneClassName: "text-amber-300",
    pillClassName: "border-amber-300/18 bg-amber-400/12 text-amber-100",
    edgeClassName: "before:bg-amber-300",
  };
}

function getCardColorClass(level: "Low change" | "Some change" | "Big change"): CourseDesignCardData["colorClass"] {
  if (level === "Big change") {
    return "red";
  }

  if (level === "Some change") {
    return "orange";
  }

  return "green";
}

function getProgressPercent(level: "Low change" | "Some change" | "Big change") {
  if (level === "Low change") {
    return 28;
  }

  if (level === "Big change") {
    return 84;
  }

  return 56;
}

function inferExploreStyleId(career: ExploreCareerRecord): QuizDimensionId {
  const normalizedTitle = career.title.toLowerCase();
  const rankedStyles = (Object.keys(STYLE_RULES) as QuizDimensionId[])
    .map((styleId) => {
      const rule = STYLE_RULES[styleId];
      const industryScore = rule.industries.includes(career.industry) ? 16 : 0;
      const pathwayScore = rule.pathways.includes(career.pathway) ? 8 : 0;
      const keywordScore = rule.titleKeywords.reduce(
        (score, keyword) => score + (normalizedTitle.includes(keyword) ? 7 : 0),
        0,
      );

      return { styleId, score: industryScore + pathwayScore + keywordScore };
    })
    .sort((left, right) => right.score - left.score);

  return rankedStyles[0]?.styleId ?? "strategist";
}

const INDUSTRY_WHAT: Partial<Record<string, string>> = {
  "Healthcare":                "Help patients recover and stay well",
  "Community Services":        "Support people going through some of life's toughest moments",
  "Technology":                "Build software, fix tech problems, and shape digital products",
  "Engineering":               "Design and build the systems and structures the world depends on",
  "Construction":              "Build the homes, roads, and buildings that surround us",
  "Business":                  "Keep companies organised, profitable, and moving forward",
  "Education":                 "Help others learn and grow — from classrooms to workplaces",
  "Agriculture & Environment": "Work with land, animals, or the natural world",
  "Creative Industries":       "Turn creative ideas into things people actually see and experience",
  "Hospitality":               "Create great experiences for customers every shift",
  "Science":                   "Research, test, and figure out how the world actually works",
};

function buildDescription(career: ExploreCareerRecord): string {
  const inShortage = /shortage/i.test(career.shortage_status);
  const isApprenticeship = career.pathway === "Apprenticeship";
  const what = INDUSTRY_WHAT[career.industry] ?? `Work in ${career.industry.toLowerCase()}`;

  if (isApprenticeship && inShortage) {
    return `${what} — get paid from day one while you train, and employers are actively hiring.`;
  }

  if (isApprenticeship) {
    return `${what} — no uni, no debt, just a paid apprenticeship and a trade for life.`;
  }

  if (inShortage && career.ai_risk === "Low") {
    return `${what} — employers are desperate for people here and AI won't replace you.`;
  }

  if (inShortage) {
    return `${what} — seriously in-demand right now across Australia.`;
  }

  if (career.ai_risk === "High") {
    return `${what} — heads up though, AI is already reshaping how this role works.`;
  }

  if (career.ai_risk === "Low") {
    return `${what} — steady demand and AI isn't going to replace this one any time soon.`;
  }

  return `${what} — get qualified via TAFE without needing a uni degree.`;
}

function getReportCareerId(career: ExploreCareerRecord, styleId: QuizDimensionId) {
  const localCareer = CAREER_CARDS.find((card) => card.title.toLowerCase() === career.title.toLowerCase());
  if (localCareer) {
    return localCareer.id;
  }

  return REPORT_CAREER_BY_DATA2_TITLE[career.title.toLowerCase()] ?? FALLBACK_REPORT_BY_STYLE[styleId];
}

function buildReportSnapshot(career: ExploreCareerRecord, styleId: QuizDimensionId): ReportCareerSnapshot {
  return {
    sourceCareerId: getReportCareerId(career, styleId),
    title: career.title,
    industry: career.industry,
    anzscoCode: career.anzsco_code,
    medianSalary: career.median_salary,
    pathway: career.pathway,
    shortageStatus: career.shortage_status,
    styleId,
  };
}

function matchesInterest(career: ExploreCareerRecord, activeInterest: string | null) {
  if (!activeInterest) {
    return true;
  }

  const matcher = INTEREST_MATCHERS[activeInterest as (typeof INTEREST_TAGS)[number]];
  return matcher ? matcher(career) : true;
}

function matchesQuery(career: ExploreCareerRecord, query: string) {
  if (!query) {
    return true;
  }

  const normalizedTitle = career.title.toLowerCase();
  const normalizedIndustry = career.industry.toLowerCase();
  const normalizedPathway = career.pathway.toLowerCase();
  const normalizedCode = career.anzsco_code.toLowerCase();

  return (
    normalizedTitle.includes(query) ||
    normalizedIndustry.includes(query) ||
    normalizedPathway.includes(query) ||
    normalizedCode.includes(query)
  );
}

function sortExploreCareers(left: ExploreCareerRecord, right: ExploreCareerRecord, query: string) {
  if (query) {
    const leftStarts = left.title.toLowerCase().startsWith(query);
    const rightStarts = right.title.toLowerCase().startsWith(query);

    if (leftStarts !== rightStarts) {
      return leftStarts ? -1 : 1;
    }
  }

  if (left.shortage_status !== right.shortage_status) {
    return /shortage/i.test(left.shortage_status) ? -1 : 1;
  }

  return left.title.localeCompare(right.title);
}

function getAutocompleteScore(item: ExploreAutocompleteItem, query: string) {
  if (!query) {
    return 1;
  }

  const value = item.value.toLowerCase();
  const detail = item.detail.toLowerCase();
  const words = value.split(/[\s/()-]+/).filter(Boolean);

  if (value === query) {
    return 0;
  }

  if (value.startsWith(query)) {
    return 120;
  }

  if (words.some((word) => word.startsWith(query))) {
    return 96;
  }

  if (detail.startsWith(query)) {
    return 72;
  }

  if (value.includes(query)) {
    return 54;
  }

  if (detail.includes(query)) {
    return 28;
  }

  return 0;
}

export default function ExploreScene({
  careers: _careers,
  searchQuery,
  searchLaunchKey,
  activeInterest,
  onSearchChange,
  onSelectInterest,
  onOpenCareer: _onOpenCareer,
  onOpenReport,
  onCompare,
  onClearFilters,
}: ExploreSceneProps) {
  const blurTimeoutRef = useRef<number | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [page, setPage] = useState(1);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [apiCareers, setApiCareers] = useState<ExploreCareerRecord[]>([]);
  const [apiReady, setApiReady] = useState(false);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedSubmittedQuery = submittedQuery.trim().toLowerCase();

  const sourceCareers = useMemo(
    () => (apiReady && apiCareers.length > 0 ? apiCareers : DATA2_CAREERS),
    [apiReady, apiCareers],
  );

  const filteredCareers = useMemo(
    () =>
      sourceCareers
        .filter((career) => matchesInterest(career, activeInterest))
        .filter((career) => matchesQuery(career, normalizedSubmittedQuery))
        .sort((left, right) => sortExploreCareers(left, right, normalizedSubmittedQuery)),
    [sourceCareers, activeInterest, normalizedSubmittedQuery],
  );
  const totalPages = Math.max(1, Math.ceil(filteredCareers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filteredCareers.length);
  const pagedCareers = filteredCareers.slice(pageStart, pageEnd);
  const autocompleteItems = useMemo(
    () =>
      EXPLORE_AUTOCOMPLETE
        .map((item) => ({
          item,
          score: getAutocompleteScore(item, normalizedQuery),
        }))
        .filter(({ item, score }) => item.value.toLowerCase() !== normalizedQuery && score > 0)
        .sort((left, right) => {
          if (right.score !== left.score) {
            return right.score - left.score;
          }

          return left.item.value.localeCompare(right.item.value);
        })
        .map(({ item }) => item)
        .slice(0, 6),
    [normalizedQuery],
  );

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!submittedQuery) {
      setApiCareers([]);
      setApiReady(false);
      return;
    }

    const controller = new AbortController();
    searchCareers({ q: submittedQuery }, { signal: controller.signal })
      .then((records) => {
        setApiCareers(records.map(fromBackendRecord));
        setApiReady(true);
      })
      .catch(() => {
        setApiCareers([]);
        setApiReady(false);
      });

    return () => controller.abort();
  }, [submittedQuery]);

  useEffect(() => {
    setPage(1);
  }, [submittedQuery, activeInterest]);

  useEffect(() => {
    if (searchLaunchKey === 0) {
      return;
    }

    submitSearch(searchQuery);
  }, [searchLaunchKey]);

  function submitSearch(nextValue = searchQuery) {
    setSubmittedQuery(nextValue.trim());
    setIsSearchFocused(false);
  }

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
            Browse career cards from the new PathwayIQ dataset, with pathway, industry, shortage signal, salary, and a simple read on how much AI might change each role.
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
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !isComposing) {
                    event.preventDefault();
                    submitSearch();
                  }
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
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
                            submitSearch(item.value);
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
              onClick={() => submitSearch()}
              className="rounded-[22px] bg-gradient-to-r from-cyan-500 to-orange-500 px-8 py-4 text-base font-semibold text-white shadow-[0_14px_34px_rgba(6,182,212,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_42px_rgba(249,115,22,0.26)]"
            >
              Discover
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
            {EXPLORE_TRENDING_QUERIES.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  onSearchChange(item.label);
                  submitSearch(item.label);
                }}
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
                {filteredCareers.length === 0 ? 0 : pageStart + 1}-{pageEnd}
              </span>
              of
              <span className="mx-1 font-semibold text-cyan-300">{filteredCareers.length}</span>
              career paths matched
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
            {QUICK_HINTS.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => {
                  onSearchChange(hint);
                  submitSearch(hint);
                }}
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
          {filteredCareers.length === 0 ? (
            <div className="rounded-[30px] border border-dashed border-white/16 bg-white/[0.04] p-8 text-slate-300 lg:col-span-2 xl:col-span-3">
              No matching careers yet. Try clearing filters or searching with broader terms.
            </div>
          ) : (
            pagedCareers.map((career) => {
              const shortage = getShortageLabel(career.shortage_status);
              const aiLevel = getAutomationLevel(career);
              const styleId = inferExploreStyleId(career);
              const style = QUIZ_DIMENSIONS[styleId];
              const reportSnapshot = buildReportSnapshot(career, styleId);
              const cardData: CourseDesignCardData = {
                id: `${career.anzsco_code}-${career.title}`,
                colorClass: getCardColorClass(aiLevel.label),
                eyebrow: career.industry,
                title: career.title,
                description: buildDescription(career),
                highlightStatLabel: "Median salary",
                highlightStatValue: formatSalary(career.median_salary),
                progressLabel: "How much AI might change this role",
                progressPercent: getProgressPercent(aiLevel.label),
                progressValue: aiLevel.label,
                chips: [`${career.pathway} pathway`, `ANZSCO ${career.anzsco_code}`],
                countdownText: shortage,
                styleLabel: style.label,
                styleTagline: style.tagline,
                styleIllustrationSrc: style.illustrationSrc,
                actionLabel: "Open report",
                onAction: () => onOpenReport(reportSnapshot),
              };

              return (
                <CourseDesignCard key={cardData.id} data={cardData} />
              );
            })
          )}
        </div>

        {filteredCareers.length > PAGE_SIZE ? (
          <div className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-[#08131f]/70 px-5 py-4 backdrop-blur-xl">
            <div className="text-sm text-slate-400">
              Page <span className="font-semibold text-white">{safePage}</span> of{" "}
              <span className="font-semibold text-white">{totalPages}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage === 1}
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
                    pageNumber === safePage
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
                disabled={safePage === totalPages}
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
