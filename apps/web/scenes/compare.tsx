import { CAREER_CARDS, type CareerId } from "@/lib/career-data";
import { QUIZ_DIMENSIONS, type QuizDimensionId } from "@/lib/quiz-data";
import careerCardsData from "../public/data2/career-cards.json";

interface CompareSceneProps {
  selectedCareerIds: CareerId[];
  onToggleCareer: (careerId: CareerId) => void;
  onOpenCareer: (careerId: CareerId) => void;
  onReport: () => void;
}

interface DataCareerRecord {
  title: string;
  pathway: string;
  industry: string;
  anzsco_code: string;
  median_salary: number;
  shortage_status: string;
}

interface CompareCareerViewModel extends DataCareerRecord {
  id: CareerId;
  styleId: QuizDimensionId;
  styleLabel: string;
  styleTagline: string;
  styleSvg: string;
  styleKeywords: string[];
}

interface StyleRule {
  industries: string[];
  pathways: string[];
  titleKeywords: string[];
}

const DATA2_CAREERS = careerCardsData as DataCareerRecord[];

const DATA2_TITLE_BY_CAREER_ID: Record<CareerId, string> = {
  "career-ds": "Software Engineer",
  "career-nurse": "Registered Nurse (Medical Practice)",
  "career-elec": "Electrician (General)",
  "career-cyber": "Security Consultant",
  "career-solar": "Electrical Engineering Technician",
  "career-wind": "Telecommunications Technician",
  "career-physio": "Therapy Aide",
  "career-ux": "Graphic Designer",
  "career-prompt": "Developer Programmer",
  "career-freight": "Transport Company Manager",
  "career-data-entry": "Data Entry Operator",
};

const STYLE_RULES: Record<QuizDimensionId, StyleRule> = {
  builder: {
    industries: ["Engineering", "Construction", "Agriculture & Environment", "Healthcare"],
    pathways: ["Apprenticeship", "TAFE"],
    titleKeywords: [
      "electrician",
      "plumber",
      "carpenter",
      "mechanic",
      "technician",
      "cabler",
      "track",
      "maint",
      "welder",
    ],
  },
  decoder: {
    industries: ["Technology", "Engineering", "Business", "Science"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: [
      "analyst",
      "developer",
      "software",
      "engineer",
      "ict",
      "data",
      "security",
      "quality",
      "consultant",
    ],
  },
  creator: {
    industries: ["Creative Industries", "Technology", "Education", "Business", "Construction"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: [
      "designer",
      "graphic",
      "interior",
      "draftsperson",
      "marketing",
      "creative",
      "signwriter",
    ],
  },
  guide: {
    industries: ["Healthcare", "Community Services", "Education"],
    pathways: ["TAFE"],
    titleKeywords: [
      "nurse",
      "therapy",
      "health",
      "care",
      "social",
      "community",
      "teacher",
      "support",
    ],
  },
  catalyst: {
    industries: ["Business", "Technology", "Engineering", "Construction"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: [
      "manager",
      "project",
      "sales",
      "lead",
      "executive",
      "transport",
      "organiser",
    ],
  },
  strategist: {
    industries: ["Business", "Education", "Technology", "Engineering", "Community Services"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: [
      "manager",
      "analyst",
      "planning",
      "policy",
      "project",
      "administrator",
      "coordinator",
    ],
  },
};

const STYLE_VISUALS: Record<
  QuizDimensionId,
  {
    borderClass: string;
    softClass: string;
    chipClass: string;
    glowClass: string;
    accentBarClass: string;
  }
> = {
  builder: {
    borderClass: "border-cyan-300/35",
    softClass: "bg-cyan-300/[0.08]",
    chipClass: "border-cyan-300/35 bg-cyan-300/15 text-cyan-100",
    glowClass: "shadow-[0_0_0_1px_rgba(103,232,249,0.12),0_20px_60px_rgba(12,74,110,0.32)]",
    accentBarClass: "from-cyan-300 via-sky-300 to-teal-300",
  },
  decoder: {
    borderClass: "border-violet-300/35",
    softClass: "bg-violet-300/[0.08]",
    chipClass: "border-violet-300/35 bg-violet-300/15 text-violet-100",
    glowClass: "shadow-[0_0_0_1px_rgba(196,181,253,0.12),0_20px_60px_rgba(76,29,149,0.32)]",
    accentBarClass: "from-violet-300 via-fuchsia-300 to-sky-300",
  },
  creator: {
    borderClass: "border-fuchsia-300/35",
    softClass: "bg-fuchsia-300/[0.08]",
    chipClass: "border-fuchsia-300/35 bg-fuchsia-300/15 text-fuchsia-100",
    glowClass: "shadow-[0_0_0_1px_rgba(244,114,182,0.12),0_20px_60px_rgba(131,24,67,0.3)]",
    accentBarClass: "from-pink-300 via-fuchsia-300 to-orange-200",
  },
  guide: {
    borderClass: "border-emerald-300/35",
    softClass: "bg-emerald-300/[0.08]",
    chipClass: "border-emerald-300/35 bg-emerald-300/15 text-emerald-100",
    glowClass: "shadow-[0_0_0_1px_rgba(110,231,183,0.12),0_20px_60px_rgba(6,78,59,0.32)]",
    accentBarClass: "from-emerald-300 via-teal-300 to-cyan-300",
  },
  catalyst: {
    borderClass: "border-amber-300/35",
    softClass: "bg-amber-300/[0.08]",
    chipClass: "border-amber-300/35 bg-amber-300/15 text-amber-100",
    glowClass: "shadow-[0_0_0_1px_rgba(253,230,138,0.12),0_20px_60px_rgba(133,77,14,0.3)]",
    accentBarClass: "from-amber-300 via-orange-300 to-rose-300",
  },
  strategist: {
    borderClass: "border-sky-300/35",
    softClass: "bg-sky-300/[0.08]",
    chipClass: "border-sky-300/35 bg-sky-300/15 text-sky-100",
    glowClass: "shadow-[0_0_0_1px_rgba(125,211,252,0.12),0_20px_60px_rgba(8,47,73,0.34)]",
    accentBarClass: "from-sky-300 via-indigo-300 to-cyan-300",
  },
};

const CAREER_DATA_BY_TITLE = new Map(DATA2_CAREERS.map((career) => [career.title, career]));

function formatSalary(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getIndustryScore(rule: StyleRule, career: DataCareerRecord) {
  const index = rule.industries.findIndex((industry) => industry === career.industry);
  return index === -1 ? 0 : Math.max(20 - index * 4, 8);
}

function getPathwayScore(rule: StyleRule, career: DataCareerRecord) {
  return rule.pathways.includes(career.pathway) ? 10 : 0;
}

function getKeywordScore(rule: StyleRule, career: DataCareerRecord) {
  const normalizedTitle = career.title.toLowerCase();
  return rule.titleKeywords.reduce((score, keyword) => {
    return normalizedTitle.includes(keyword) ? score + 6 : score;
  }, 0);
}

function inferCareerStyleId(career: DataCareerRecord): QuizDimensionId {
  const rankedStyles = (Object.keys(STYLE_RULES) as QuizDimensionId[])
    .map((styleId) => {
      const rule = STYLE_RULES[styleId];
      const score =
        getIndustryScore(rule, career) +
        getPathwayScore(rule, career) +
        getKeywordScore(rule, career);

      return { styleId, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.styleId.localeCompare(right.styleId);
    });

  return rankedStyles[0]?.styleId ?? "strategist";
}

function buildCompareCareer(careerId: CareerId): CompareCareerViewModel | null {
  const title = DATA2_TITLE_BY_CAREER_ID[careerId];
  const match = CAREER_DATA_BY_TITLE.get(title);

  if (!match) {
    return null;
  }

  const styleId = inferCareerStyleId(match);
  const style = QUIZ_DIMENSIONS[styleId];

  return {
    ...match,
    id: careerId,
    styleId,
    styleLabel: style.label,
    styleTagline: style.tagline,
    styleSvg: style.illustrationSrc,
    styleKeywords: style.workLikes,
  };
}

function buildCompareRows(left: CompareCareerViewModel, right: CompareCareerViewModel) {
  return [
    { label: "Style", left: left.styleLabel, right: right.styleLabel },
    { label: "Industry", left: left.industry, right: right.industry },
    { label: "Pathway", left: left.pathway, right: right.pathway },
    { label: "Median salary", left: formatSalary(left.median_salary), right: formatSalary(right.median_salary) },
    { label: "Shortage status", left: left.shortage_status, right: right.shortage_status },
    { label: "ANZSCO", left: left.anzsco_code, right: right.anzsco_code },
  ];
}

function EmptyCompareSlot() {
  return (
    <div className="flex min-h-[470px] flex-col items-center justify-center rounded-[30px] border border-dashed border-white/12 bg-white/[0.04] px-8 py-10 text-center">
      <div className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
        Open slot
      </div>
      <h3 className="mt-6 text-2xl font-semibold text-white">Pick one more role</h3>
      <p className="mt-4 max-w-sm text-base leading-7 text-slate-400">
        Keep this page to a clean two-role showdown. Swap one in below whenever you want a different match-up.
      </p>
    </div>
  );
}

function CompareHeroCard({
  career,
  slotLabel,
  onOpenCareer,
}: {
  career: CompareCareerViewModel;
  slotLabel: string;
  onOpenCareer: (careerId: CareerId) => void;
}) {
  const theme = STYLE_VISUALS[career.styleId];

  return (
    <article
      className={[
        "relative overflow-hidden rounded-[32px] border bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(8,47,73,0.82))] p-6",
        theme.borderClass,
        theme.glowClass,
      ].join(" ")}
    >
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${theme.accentBarClass}`} />
      <div className="absolute -right-8 top-6 h-28 w-28 rounded-full bg-white/5 blur-2xl" />

      <div className="flex items-start justify-between gap-5">
        <div className="max-w-[60%]">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            {slotLabel}
          </div>
          <h3 className="mt-3 text-2xl font-semibold leading-tight text-white">{career.title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{career.styleTagline}</p>
        </div>

        <div
          className={[
            "flex h-28 w-28 shrink-0 items-center justify-center rounded-[28px] border bg-white/90 p-3",
            theme.borderClass,
          ].join(" ")}
        >
          <img
            src={career.styleSvg}
            alt={`${career.styleLabel} style illustration`}
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${theme.chipClass}`}>
          {career.styleLabel} style
        </span>
        <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-slate-200">
          {career.industry}
        </span>
        <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-slate-200">
          {career.pathway}
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className={`rounded-[22px] border p-4 ${theme.borderClass} ${theme.softClass}`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Median salary
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{formatSalary(career.median_salary)}</div>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Shortage status
          </div>
          <div className="mt-2 text-lg font-semibold text-white">{career.shortage_status}</div>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            ANZSCO
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">{career.anzsco_code}</div>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/[0.05] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Work vibe
          </div>
          <div className="mt-2 text-sm font-medium leading-6 text-slate-200">
            {career.styleKeywords.slice(0, 2).join(" · ")}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenCareer(career.id)}
        className="mt-6 inline-flex items-center rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/28 hover:bg-white/12"
      >
        Open this role
      </button>
    </article>
  );
}

export default function CompareScene({
  selectedCareerIds,
  onToggleCareer,
  onOpenCareer,
  onReport,
}: CompareSceneProps) {
  const compareOptions = CAREER_CARDS.map((career) => buildCompareCareer(career.id)).filter(
    (career): career is CompareCareerViewModel => Boolean(career),
  );
  const selectedCareers = selectedCareerIds
    .map((careerId) => buildCompareCareer(careerId))
    .filter((career): career is CompareCareerViewModel => Boolean(career))
    .slice(0, 2);

  const compareRows =
    selectedCareers.length === 2 ? buildCompareRows(selectedCareers[0], selectedCareers[1]) : [];

  return (
    <section className="relative h-screen w-screen shrink-0 snap-start overflow-y-auto px-6 pb-36 pt-28">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="xl:sticky xl:top-28 xl:self-start">
            <div className="rounded-[32px] border border-white/10 bg-white/[0.05] p-7 shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7dd3fc]">
                Scene 04
              </div>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Compare two real roles, not a whole spreadsheet.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                This version only uses the structured job data we already have in
                <span className="font-semibold text-slate-100"> data2</span>. Pick any two roles, then
                compare the info students actually care about fast: salary, pathway, shortage status,
                ANZSCO code, and the vibe-style each role leans toward.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
                    Compare limit
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">2 roles</div>
                </div>
                <div className="rounded-[22px] border border-fuchsia-400/20 bg-fuchsia-400/10 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-100/80">
                    Current set
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">{selectedCareers.length}/2</div>
                </div>
              </div>

              <button
                type="button"
                onClick={onReport}
                className="mt-7 inline-flex items-center rounded-2xl bg-[#57b6ff] px-6 py-3 font-semibold text-[#02121f] transition hover:translate-y-[-1px] hover:bg-[#7cc8ff]"
              >
                Continue to report {"->"}
              </button>
            </div>
          </div>

          <div className="space-y-8">
            <div className="grid gap-5 lg:grid-cols-2">
              {selectedCareers[0] ? (
                <CompareHeroCard
                  career={selectedCareers[0]}
                  slotLabel="Role 01"
                  onOpenCareer={onOpenCareer}
                />
              ) : (
                <EmptyCompareSlot />
              )}

              {selectedCareers[1] ? (
                <CompareHeroCard
                  career={selectedCareers[1]}
                  slotLabel="Role 02"
                  onOpenCareer={onOpenCareer}
                />
              ) : (
                <EmptyCompareSlot />
              )}
            </div>

            {selectedCareers.length === 2 ? (
              <div className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.05] shadow-[0_24px_90px_rgba(0,0,0,0.2)]">
                <div className="grid grid-cols-[0.7fr_1fr_1fr] border-b border-white/10 bg-white/[0.04]">
                  <div className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Field
                  </div>
                  <div className="px-5 py-4 text-sm font-semibold text-white">{selectedCareers[0].title}</div>
                  <div className="px-5 py-4 text-sm font-semibold text-white">{selectedCareers[1].title}</div>
                </div>
                {compareRows.map((row, index) => (
                  <div
                    key={row.label}
                    className={[
                      "grid grid-cols-[0.7fr_1fr_1fr] items-start",
                      index !== compareRows.length - 1 ? "border-b border-white/8" : "",
                    ].join(" ")}
                  >
                    <div className="px-5 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {row.label}
                    </div>
                    <div className="px-5 py-4 text-sm leading-6 text-slate-200">{row.left}</div>
                    <div className="px-5 py-4 text-sm leading-6 text-slate-200">{row.right}</div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.18)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Swap roles
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Tap a card to keep it in your two-role match-up</h3>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
                  Compare scene is capped at 2 selections
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {compareOptions.map((career) => {
                  const selected = selectedCareerIds.includes(career.id);
                  const theme = STYLE_VISUALS[career.styleId];

                  return (
                    <button
                      key={career.id}
                      type="button"
                      onClick={() => onToggleCareer(career.id)}
                      aria-pressed={selected}
                      className={[
                        "rounded-[24px] border p-4 text-left transition",
                        selected
                          ? `${theme.borderClass} ${theme.softClass} ${theme.glowClass}`
                          : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] border bg-white/90 p-2 ${theme.borderClass}`}>
                          <img
                            src={career.styleSvg}
                            alt={`${career.styleLabel} style illustration`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-base font-semibold leading-snug text-white">{career.title}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {career.industry} · {career.pathway}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${theme.chipClass}`}>
                              {career.styleLabel}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-slate-300">
                              {formatSalary(career.median_salary)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
