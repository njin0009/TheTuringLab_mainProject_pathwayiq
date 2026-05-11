"use client";

import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardCheck,
  Download,
  LineChart,
  Route,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import { CardCarousel } from "@/components/ui/card-carousel";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { Button } from "@/components/ui/button";
import GradientCardShowcase from "@/components/ui/gradient-card-showcase";
import { CAREER_PROFILES, type CareerId } from "@/lib/career-data";
import { EXPLORE_TRENDING_QUERIES } from "@/lib/explore-trends";
import { REPORT_STYLE_BY_CAREER_ID } from "@/lib/report-style";
import { STYLE_FIGURES } from "@/lib/style-figures";
import { QUIZ_DIMENSIONS, type QuizDimensionId } from "@/lib/quiz-data";
import type { ReportCareerSnapshot } from "@/lib/report-career";

interface ReportSceneProps {
  careerId: CareerId;
  dynamicCareer?: ReportCareerSnapshot | null;
  hasReportInput: boolean;
  startPanelVisible: boolean;
  onStart: () => void;
  onStartBack: () => void;
  onTakeQuiz: () => void;
  onExplore: (query?: string) => void;
  onOpenCareer: (careerId: CareerId) => void;
  onCompare: (careerId: CareerId) => void;
  onRestart: () => void;
}

type DemandLevel = "High" | "Medium" | "Low";
type PathwayType = "University" | "TAFE" | "Apprenticeship" | "Online";

interface BackendReadyCareerReport {
  career: {
    id: string;
    title: string;
    industry: string;
    summary: string;
    anzscoCode?: string;
    sourceStatus?: string;
    salary: { entry: number; mid: number; senior: number };
    demand: { vic: DemandLevel; national: DemandLevel };
    growth_10yr: number;
    ai_risk: number;
    shortage: boolean;
    disappearing: boolean;
    labels: string[];
    pathways: Array<{
      type: PathwayType;
      name: string;
      atar_required: string;
    }>;
    atar_typical: number | null;
    interests: string[];
  };
  generatedAt: string;
  dataSources: string[];
}

const generatedAt = "2026-05-05T00:00:00.000Z";

function sectionTitle(label: string, title: string, detail?: string) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <div className="h-1 w-10 rounded-full bg-[#0f8b8d]" />
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</div>
      </div>
      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 md:text-[2rem]">{title}</h3>
      {detail ? <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500 md:text-base">{detail}</p> : null}
    </div>
  );
}

function findStat(stats: { lbl: string; val: string }[], label: string) {
  return stats.find((entry) => entry.lbl === label)?.val ?? "";
}

function parseSalaryRange(value: string) {
  const matches = value.match(/\$([\d,]+)\s*-\s*\$([\d,]+)/i);
  if (!matches) {
    return { min: 85, max: 110 };
  }

  return {
    min: Number.parseInt(matches[1].replace(/,/g, ""), 10) || 85,
    max: Number.parseInt(matches[2].replace(/,/g, ""), 10) || 110,
  };
}

function parseGrowthPercent(value: string) {
  const match = value.match(/([+-]?\d+)%/);
  if (!match) return 0;
  return Number.parseInt(match[1], 10) || 0;
}

function parseATAR(value: string) {
  if (!value || /no atar/i.test(value) || /flexible/i.test(value)) return null;
  const match = value.match(/(\d{2})/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function getDemandLevel(value: string): DemandLevel {
  const lower = value.toLowerCase();
  if (lower.includes("very high") || lower.includes("high")) return "High";
  if (lower.includes("declining") || lower.includes("low")) return "Low";
  return "Medium";
}

function getNationalDemand(growth: number, shortage: boolean, disappearing: boolean): DemandLevel {
  if (disappearing) return "Low";
  if (shortage || growth >= 15) return "High";
  if (growth <= 0) return "Low";
  return "Medium";
}

function getPathwayType(value: string): PathwayType {
  const lower = value.toLowerCase();
  if (lower.includes("apprenticeship")) return "Apprenticeship";
  if (lower.includes("tafe") || lower.includes("diploma") || lower.includes("vet")) return "TAFE";
  if (lower.includes("bootcamp") || lower.includes("portfolio")) return "Online";
  return "University";
}

function getAIRiskLabel(score: number) {
  if (score < 0.35) return "Low AI change";
  if (score < 0.65) return "Some AI change";
  return "Big AI change";
}

function estimateAIRisk(career: ReportCareerSnapshot) {
  const title = career.title.toLowerCase();

  if (
    ["Healthcare", "Community Services", "Construction", "Engineering", "Agriculture & Environment"].includes(
      career.industry,
    ) ||
    career.pathway === "Apprenticeship"
  ) {
    return 0.22;
  }

  if (/clerk|attendant|barista|bookkeeper|cashier|reception|entry|retail|waiter|worker|assistant/i.test(title)) {
    return 0.78;
  }

  return 0.48;
}

function buildLabels(shortage: boolean, disappearing: boolean, aiRisk: number) {
  const labels: string[] = [];
  if (shortage) labels.push("In demand");
  if (disappearing) labels.push("Declining");
  labels.push(getAIRiskLabel(aiRisk));
  return labels;
}

function formatSalary(value: number) {
  return `$${value.toLocaleString()}`;
}

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const STYLE_NEXT_STEP_CONTENT: Record<
  QuizDimensionId,
  {
    celebrity: { title: string; detail: string; highlights: string[] };
    article: { title: string; detail: string; highlights: string[] };
    platform: { title: string; detail: string; highlights: string[] };
    action: { title: string; detail: string; highlights: string[] };
  }
> = {
  builder: {
    celebrity: {
      title: "Study practical creators",
      detail: "Follow people who make complicated things feel buildable and real.",
      highlights: ["Mark Rober", "Beau Miles", "real build videos"],
    },
    article: {
      title: "Read hands-on pathway stories",
      detail: "Look for trade, technician, and infrastructure stories that show what a real workday feels like.",
      highlights: ["apprenticeship day-in-the-life", "site work", "tools and systems"],
    },
    platform: {
      title: "Search where practical roles live",
      detail: "Use platforms that show apprenticeships, VET routes, and technical field jobs clearly.",
      highlights: ["SEEK", "Apprenticeships.gov.au", "TAFE course finder"],
    },
    action: {
      title: "Make one proof point",
      detail: "Do one task where you build, repair, test, or set up something and keep a photo or note.",
      highlights: ["mini build", "setup task", "photo evidence"],
    },
  },
  decoder: {
    celebrity: {
      title: "Follow pattern-finders",
      detail: "Choose people whose work is about analysis, systems, and figuring out what others miss.",
      highlights: ["Dr Karl", "cyber analysts", "data storytellers"],
    },
    article: {
      title: "Read system-thinking pieces",
      detail: "Prioritise explainers about how data, risk, software, or digital systems really work.",
      highlights: ["cyber explainers", "data case studies", "how systems fail"],
    },
    platform: {
      title: "Browse analytical roles",
      detail: "Search platforms that surface graduate and technical roles with clear skill keywords.",
      highlights: ["LinkedIn Jobs", "GradConnection", "SEEK"],
    },
    action: {
      title: "Solve one small problem",
      detail: "Try one logic-heavy mini project, challenge, or analysis task and save your result.",
      highlights: ["mini analysis", "logic challenge", "notes screenshot"],
    },
  },
  creator: {
    celebrity: {
      title: "Watch idea-shapers",
      detail: "Follow people who turn concepts into things others can actually see, use, or feel.",
      highlights: ["Melanie Perkins", "design creators", "product storytellers"],
    },
    article: {
      title: "Read creative process stories",
      detail: "Look for breakdowns of product design, campaigns, interfaces, and concept development.",
      highlights: ["UX case study", "brand thinking", "creative process"],
    },
    platform: {
      title: "Search portfolio-first spaces",
      detail: "Use job platforms where creative roles and portfolio signals are easy to compare.",
      highlights: ["The Loop", "Behance", "LinkedIn Jobs"],
    },
    action: {
      title: "Ship one small concept",
      detail: "Create one mockup, short visual, pitch deck, or interface idea and keep it as evidence.",
      highlights: ["mockup", "one-page concept", "prototype screen"],
    },
  },
  guide: {
    celebrity: {
      title: "Follow people-centred voices",
      detail: "Choose role models who are known for trust, care, communication, and helping people move forward.",
      highlights: ["Brené Brown", "health advocates", "education voices"],
    },
    article: {
      title: "Read human-impact stories",
      detail: "Look for articles about care work, coaching, health, teaching, or student support in real settings.",
      highlights: ["patient stories", "community support", "teaching impact"],
    },
    platform: {
      title: "Browse roles with real human contact",
      detail: "Search platforms that make service, care, education, and support work easy to scan.",
      highlights: ["SEEK", "EthicalJobs", "Health Careers"],
    },
    action: {
      title: "Test your support energy",
      detail: "Volunteer, tutor, help coach, or take on one support task and reflect on how it felt.",
      highlights: ["peer support", "volunteering", "reflection note"],
    },
  },
  catalyst: {
    celebrity: {
      title: "Follow momentum-builders",
      detail: "Look at people known for influence, initiative, and getting projects moving fast.",
      highlights: ["Steven Bartlett", "startup founders", "campaign leads"],
    },
    article: {
      title: "Read launch and leadership stories",
      detail: "Focus on stories about building traction, persuading people, and moving from idea to action.",
      highlights: ["launch story", "team momentum", "decision-making"],
    },
    platform: {
      title: "Search action-heavy roles",
      detail: "Use broad platforms where leadership, project, and growth roles show up often.",
      highlights: ["LinkedIn Jobs", "SEEK", "GradConnection"],
    },
    action: {
      title: "Lead one visible thing",
      detail: "Own one mini event, project, or campaign and keep the outcome as evidence you can drive action.",
      highlights: ["lead a task", "run a mini project", "outcome screenshot"],
    },
  },
  strategist: {
    celebrity: {
      title: "Study calm planners",
      detail: "Follow people known for structure, sequencing, and turning messy work into stable systems.",
      highlights: ["Indra Nooyi", "operations leaders", "project planners"],
    },
    article: {
      title: "Read planning and operations pieces",
      detail: "Look for articles on process design, coordination, project flow, and making systems hold up.",
      highlights: ["project planning", "operations thinking", "workflow design"],
    },
    platform: {
      title: "Browse structure-led roles",
      detail: "Use platforms that surface coordinator, admin, policy, and project roles clearly.",
      highlights: ["SEEK", "LinkedIn Jobs", "GradConnection"],
    },
    action: {
      title: "Organise one system better",
      detail: "Take one messy schedule, task flow, or study system and redesign it so it runs more smoothly.",
      highlights: ["workflow tidy-up", "task board", "before/after proof"],
    },
  },
};

function buildNextSteps(
  roleContext: {
    title: string;
    industry: string;
    pathway: string;
    shortageStatus?: string;
  },
  styleId: QuizDimensionId,
) {
  const content = STYLE_NEXT_STEP_CONTENT[styleId];
  const roleTitle = roleContext.title;
  const pathway = roleContext.pathway || "the most relevant pathway";

  return [
    {
      label: "Role model",
      title: content.celebrity.title,
      detail: `${content.celebrity.detail} Compare their habits with the kind of work a ${roleTitle} does day to day.`,
      highlights: content.celebrity.highlights,
      icon: Sparkles,
      owner: "Inspiration",
      tone: "from-[#dff7f5] to-white",
    },
    {
      label: "Read next",
      title: content.article.title,
      detail: `${content.article.detail} Start with a search around ${roleTitle} so the reading stays close to this specific role.`,
      highlights: content.article.highlights,
      icon: ClipboardCheck,
      owner: "Reading",
      tone: "from-[#eef6ff] to-white",
    },
    {
      label: "Search platforms",
      title: content.platform.title,
      detail: `${content.platform.detail} Filter for ${roleTitle}, ${roleContext.industry}, and ${pathway} options.`,
      highlights: content.platform.highlights,
      icon: BriefcaseBusiness,
      owner: "Search",
      tone: "from-[#fff5ea] to-white",
    },
    {
      label: "Do one real test",
      title: content.action.title,
      detail: `${content.action.detail} Make the test relevant to ${roleTitle}, then save it as evidence for applications or course interviews.`,
      highlights: content.action.highlights,
      icon: Target,
      owner: "Action",
      tone: "from-[#f3efff] to-white",
    },
  ];
}

function adaptCareerToReport(career: (typeof CAREER_PROFILES)[CareerId]): BackendReadyCareerReport {
  const salaryRange = parseSalaryRange(career.salary);
  const growth = parseGrowthPercent(findStat(career.stats, "10yr growth"));
  const vicDemandStat = findStat(career.stats, "VIC demand");
  const atarRequired = findStat(career.stats, "ATAR needed");
  const pathwayName = findStat(career.stats, "Pathway");
  const industry = career.badge.split("·")[0]?.trim() || "Career";
  const shortage = /shortage/i.test(career.badge);
  const disappearing = /disappear|declining/i.test(career.badge) || /declining/i.test(vicDemandStat);
  const aiRisk = Math.max(0, Math.min(career.riskPercent / 100, 1));

  return {
    career: {
      id: career.id,
      title: career.title,
      industry,
      summary: career.summary,
      sourceStatus: career.badge,
      salary: {
        entry: salaryRange.min * 1000,
        mid: Math.round(((salaryRange.min + salaryRange.max) / 2) * 1000),
        senior: salaryRange.max * 1000,
      },
      demand: {
        vic: getDemandLevel(vicDemandStat),
        national: getNationalDemand(growth, shortage, disappearing),
      },
      growth_10yr: growth,
      ai_risk: aiRisk,
      shortage,
      disappearing,
      labels: buildLabels(shortage, disappearing, aiRisk),
      pathways: pathwayName
        ? [
            {
              type: getPathwayType(pathwayName),
              name: pathwayName,
              atar_required: atarRequired || "Not specified",
            },
          ]
        : [],
      atar_typical: parseATAR(atarRequired),
      interests: career.interestBuckets,
    },
    generatedAt,
    dataSources: [career.source.replace(/^Source:\s*/i, "")],
  };
}

function adaptDynamicCareerToReport(career: ReportCareerSnapshot, styleId: QuizDimensionId): BackendReadyCareerReport {
  const shortage = /shortage/i.test(career.shortageStatus);
  const disappearing = /declining|automation exposed|transition/i.test(career.shortageStatus);
  const aiRisk = estimateAIRisk(career);
  const medianSalary = career.medianSalary || 85000;
  const style = QUIZ_DIMENSIONS[styleId];

  return {
    career: {
      id: career.anzscoCode,
      title: career.title,
      industry: career.industry,
      summary: `${career.title} sits in ${career.industry} and is usually reached through a ${career.pathway} pathway. This report is generated from the selected Explore card, so the demand, pay, pathway, style, and next-step guidance are tailored to this specific role.`,
      anzscoCode: career.anzscoCode,
      sourceStatus: career.shortageStatus,
      salary: {
        entry: Math.round(medianSalary * 0.82),
        mid: medianSalary,
        senior: Math.round(medianSalary * 1.24),
      },
      demand: {
        vic: shortage ? "High" : "Medium",
        national: shortage ? "High" : "Medium",
      },
      growth_10yr: shortage ? 14 : 6,
      ai_risk: aiRisk,
      shortage,
      disappearing,
      labels: buildLabels(shortage, disappearing, aiRisk),
      pathways: [
        {
          type: getPathwayType(career.pathway),
          name: career.pathway,
          atar_required: career.pathway === "University" ? "Check course entry" : "No ATAR required",
        },
      ],
      atar_typical: null,
      interests: Array.from(
        new Set([style.exploreInterest, ...style.workLikes].filter((value): value is string => Boolean(value))),
      ),
    },
    generatedAt,
    dataSources: [`JSA 2025 OSL · ANZSCO ${career.anzscoCode}`],
  };
}

function ReportGeneratingState({
  panelVisible,
  onStart,
  onStartBack,
  onTakeQuiz,
  onExplore,
  onCompare,
}: {
  panelVisible: boolean;
  onStart: () => void;
  onStartBack: () => void;
  onTakeQuiz: () => void;
  onExplore: (query?: string) => void;
  onCompare: () => void;
}) {
  const pathChoiceItems = [
    {
      id: "quiz",
      title: "Quiz",
      description: "Answer a few guided questions and get matched roles you can explore next.",
      eyebrow: "Guided start",
      ctaLabel: "Start Quiz",
      gradientFrom: "#00c2ff",
      gradientTo: "#4dffcf",
      onSelect: onTakeQuiz,
    },
    {
      id: "explore",
      title: "Explore",
      description: "Browse pathways and career cards, then open a report from any role card.",
      eyebrow: "Open browse",
      ctaLabel: "Open Explore",
      gradientFrom: "#4f7cff",
      gradientTo: "#00d0ff",
      onSelect: () => onExplore(),
    },
    {
      id: "compare",
      title: "Compare",
      description: "Compare options side by side before choosing a role to generate a report.",
      eyebrow: "Fast track",
      ctaLabel: "Go to Compare",
      gradientFrom: "#ffbc00",
      gradientTo: "#ff5b45",
      onSelect: onCompare,
    },
  ];

  return (
    <section className="relative h-screen w-screen shrink-0 overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(15,139,141,0.18),transparent_30%),linear-gradient(180deg,#eef3fb_0%,#dfe8f3_100%)] px-6 py-24 text-slate-950">
      <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-[36px] border border-white/70 bg-white/72 p-8 text-center shadow-[0_28px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl md:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#e8f7f7] text-4xl">
            🧭
          </div>
          <div className="mt-6 text-xs font-semibold uppercase tracking-[0.34em] text-[#0f8b8d]">
            Career report
          </div>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Your report is being generated
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            Choose a starting path first. Once you open a role from Explore, Compare, or a career card, this page will generate a role-specific report.
          </p>

          <div className="mt-8 flex flex-col items-center gap-5 md:flex-row md:justify-center">
            <button
              type="button"
              onClick={onStart}
              className="rounded-full border border-cyan-400/35 bg-gradient-to-r from-cyan-500 to-orange-500 px-10 py-4 text-base font-semibold text-white shadow-[0_18px_56px_rgba(6,182,212,0.22)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_64px_rgba(249,115,22,0.28)]"
            >
              Start
            </button>
            <div className="flex flex-wrap justify-center gap-3">
              {EXPLORE_TRENDING_QUERIES.slice(0, 3).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onExplore(item.label)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-[#0f8b8d]/40 hover:text-[#0f8b8d]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {panelVisible ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/36 backdrop-blur-[2px]" />
          <div className="pointer-events-auto relative w-full max-w-6xl rounded-[34px] border border-cyan-400/16 bg-[#071018]/78 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-xl">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
                  Choose Your Path
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-white md:text-4xl">
                  Start the journey in the way that feels right first.
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/72 md:text-base">
                  Pick the entrance that matches how you want to begin. Each card takes you straight into a real PathwayIQ flow.
                </p>
              </div>
              <button
                type="button"
                onClick={onStartBack}
                className="w-fit rounded-full border border-cyan-400/18 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:border-cyan-400/32 hover:bg-cyan-400/8"
              >
                {"<-"} Back
              </button>
            </div>
            <div className="mt-2">
              <GradientCardShowcase items={pathChoiceItems} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function ReportScene({
  careerId,
  dynamicCareer,
  hasReportInput,
  startPanelVisible,
  onStart,
  onStartBack,
  onTakeQuiz,
  onExplore,
  onCompare,
  onRestart,
}: ReportSceneProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const career = CAREER_PROFILES[careerId];

  if (!hasReportInput) {
    return (
      <ReportGeneratingState
        panelVisible={startPanelVisible}
        onStart={onStart}
        onStartBack={onStartBack}
        onTakeQuiz={onTakeQuiz}
        onExplore={onExplore}
        onCompare={() => onCompare(careerId)}
      />
    );
  }

  const reportStyleId = dynamicCareer?.styleId ?? REPORT_STYLE_BY_CAREER_ID[career.id];
  const report = dynamicCareer
    ? adaptDynamicCareerToReport(dynamicCareer, reportStyleId)
    : adaptCareerToReport(career);
  const reportStyle = QUIZ_DIMENSIONS[reportStyleId];
  const styleFigures = STYLE_FIGURES[reportStyleId];
  const nextSteps = buildNextSteps(
    {
      title: report.career.title,
      industry: report.career.industry,
      pathway: report.career.pathways[0]?.name ?? "the most relevant pathway",
      shortageStatus: report.career.sourceStatus,
    },
    reportStyleId,
  );
  const reportIcon = dynamicCareer ? "🧭" : career.icon;
  const compareCareerId = dynamicCareer?.sourceCareerId ?? career.id;
  const shareUrl = encodeURIComponent("https://pathwayiq.pages.dev");
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;

  async function handleDownloadReport() {
    setIsDownloading(true);

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 48;
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      const addPageIfNeeded = (needed = 64) => {
        if (y + needed > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      const addText = (text: string, size = 11, style: "normal" | "bold" = "normal", gap = 8) => {
        pdf.setFont("helvetica", style);
        pdf.setFontSize(size);
        const lines = pdf.splitTextToSize(text, maxWidth);
        addPageIfNeeded(lines.length * (size + 5) + gap);
        pdf.text(lines, margin, y);
        y += lines.length * (size + 5) + gap;
      };

      const addLabel = (label: string, value: string) => {
        addPageIfNeeded(42);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(label.toUpperCase(), margin, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(15);
        pdf.text(value, margin + 170, y);
        y += 28;
      };

      pdf.setFillColor(15, 139, 141);
      pdf.rect(0, 0, pageWidth, 18, "F");
      addText("PathwayIQ Career Report", 13, "bold", 14);
      addText(report.career.title, 28, "bold", 10);
      addText(report.career.summary, 11, "normal", 18);

      addText("Key data", 16, "bold", 12);
      addLabel("Industry", report.career.industry);
      if (report.career.anzscoCode) {
        addLabel("ANZSCO", report.career.anzscoCode);
      }
      if (report.career.sourceStatus) {
        addLabel("Status", report.career.sourceStatus);
      }
      addLabel("Demand in Victoria", report.career.demand.vic);
      addLabel("AI change", getAIRiskLabel(report.career.ai_risk));
      addLabel("Entry pay", formatSalary(report.career.salary.entry));
      addLabel("Mid career", formatSalary(report.career.salary.mid));
      addLabel("Senior", formatSalary(report.career.salary.senior));
      addLabel("Pathway", report.career.pathways[0]?.name ?? "Not connected yet");

      y += 10;
      addText("Style type", 16, "bold", 10);
      addText(`${reportStyle.label}: ${reportStyle.tagline}`, 12, "normal", 12);
      addText(`Style signals: ${reportStyle.workLikes.slice(0, 3).join(", ")}`, 11, "normal", 16);

      addText("Icons and role models", 16, "bold", 10);
      styleFigures.forEach((figure) => {
        addText(`${figure.name} - ${figure.field}`, 12, "bold", 2);
        addText(`${figure.lesson} ${figure.wikiUrl}`, 10, "normal", 8);
      });

      addText("Next steps", 16, "bold", 10);
      nextSteps.forEach((step) => {
        addText(`${step.label}: ${step.title}`, 12, "bold", 2);
        addText(step.detail, 10, "normal", 8);
      });

      addText("Sources", 16, "bold", 10);
      report.dataSources.forEach((source) => addText(source, 10, "normal", 4));

      pdf.save(`pathwayiq-${safeFilename(report.career.title)}-report.pdf`);
    } finally {
      setIsDownloading(false);
    }
  }

  const insightCards = [
    {
      label: "Demand in Victoria",
      value: report.career.demand.vic,
      detail: report.career.shortage
        ? `${report.career.title} is flagged with an active shortage signal.`
        : `${report.career.title} is not currently flagged as shortage, but still has a visible pathway signal.`,
      icon: LineChart,
      tone: "bg-emerald-500/12 text-emerald-700",
    },
    {
      label: "AI change",
      value: getAIRiskLabel(report.career.ai_risk),
      detail: `${Math.round(report.career.ai_risk * 100)}% change signal estimated for ${report.career.title}`,
      icon: ShieldCheck,
      tone: "bg-indigo-500/12 text-indigo-700",
    },
    {
      label: "Entry pay",
      value: formatSalary(report.career.salary.entry),
      detail: `Median ${formatSalary(report.career.salary.mid)} · Senior ${formatSalary(report.career.salary.senior)}`,
      icon: BriefcaseBusiness,
      tone: "bg-amber-500/12 text-amber-700",
    },
    {
      label: "Pathway signal",
      value: report.career.pathways[0]?.type ?? "Not connected yet",
      detail: report.career.pathways[0]?.name ?? `Pathway detail for ${report.career.title} can land here later.`,
      icon: Route,
      tone: "bg-cyan-500/12 text-cyan-700",
    },
  ];

  return (
    <section className="relative h-screen w-screen shrink-0 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(15,139,141,0.16),transparent_32%),linear-gradient(180deg,#eef3fb_0%,#dfe8f3_100%)] px-4 pb-16 text-slate-900 md:px-8">
      <ContainerScroll
        titleComponent={
          <div className="mx-auto max-w-4xl px-4">
            <div className="text-xs font-semibold uppercase tracking-[0.34em] text-[#0f8b8d]">
              PathwayIQ career report
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-[5.5rem] md:leading-none">
              Your report is ready
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
              Scroll to open the report inside the tablet frame. The content below is designed to be read vertically, with the key data first.
            </p>
          </div>
        }
      >
        <article className="h-full overflow-y-auto bg-[#f6f8fc] text-slate-900">
          <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4 py-5 md:px-7 md:py-7">
            <header className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[#e8f7f7] text-4xl">
                    {reportIcon}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {report.career.industry}
                      </span>
                      {report.career.anzscoCode ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          ANZSCO {report.career.anzscoCode}
                        </span>
                      ) : null}
                      {report.career.sourceStatus ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {report.career.sourceStatus}
                        </span>
                      ) : null}
                      {report.career.labels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-[#0f8b8d]/18 bg-[#eefafa] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#0f8b8d]"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                      {report.career.title}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 md:text-base">
                      {report.career.summary}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {insightCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</div>
                        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${card.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{card.value}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{card.detail}</p>
                    </div>
                  );
                })}
              </div>
            </header>

            <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#0f8b8d]">Style type</div>
                  <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{reportStyle.label}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{reportStyle.tagline}</p>
                </div>
                <div className="flex flex-wrap gap-2 md:max-w-sm md:justify-end">
                  {reportStyle.workLikes.slice(0, 3).map((keyword) => (
                    <span key={keyword} className="rounded-full bg-[#e8f7f7] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0f8b8d]">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[26px] bg-[linear-gradient(180deg,#0f8b8d_0%,#106e74_100%)] p-3 text-white md:p-4">
                <CardCarousel
                  figures={styleFigures}
                  autoplayDelay={3200}
                  showPagination
                  showNavigation
                />
              </div>
            </section>

            <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-4 flex items-center gap-3">
                <Target className="h-5 w-5 text-[#0f8b8d]" />
                <h3 className="text-xl font-semibold text-slate-950">Next steps</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {nextSteps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className={`rounded-[22px] border border-slate-200 bg-gradient-to-br ${step.tone} p-4`}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0f8b8d] text-white">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0f8b8d]">{step.label}</div>
                          <div className="mt-1 text-base font-semibold text-slate-950">{step.title}</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                {report.career.interests.map((interest) => (
                  <span key={interest} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {interest}
                  </span>
                ))}
              </div>
              <div className="mt-4 space-y-2 text-sm leading-6 text-slate-500">
                {report.dataSources.map((source) => (
                  <div key={source}>Source: {source}</div>
                ))}
              </div>
            </section>

          </div>
        </article>
      </ContainerScroll>

      <footer className="relative z-[240] mx-auto -mt-12 mb-24 max-w-5xl overflow-x-auto px-2 pt-3">
        <div className="flex min-w-max items-center justify-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="lg"
              onClick={handleDownloadReport}
              disabled={isDownloading}
              className="h-12 rounded-full border border-slate-950 bg-white px-6 text-base font-semibold text-slate-950 shadow-[0_16px_34px_rgba(15,23,42,0.14)] transition-all duration-200 hover:-translate-y-1 hover:bg-white hover:shadow-[0_22px_48px_rgba(15,23,42,0.24)] hover:ring-2 hover:ring-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? "Preparing PDF" : "Download report"}
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={() => setShareOpen((current) => !current)}
              className="h-12 rounded-full border border-slate-950 bg-slate-950 px-6 text-base font-semibold text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-1 hover:bg-black hover:shadow-[0_22px_48px_rgba(15,23,42,0.28)] hover:ring-2 hover:ring-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
          {shareOpen ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                onClick={() => window.open(linkedInShareUrl, "_blank", "noopener,noreferrer")}
                aria-label="Share to LinkedIn"
                title="LinkedIn"
                variant="outline"
                className="h-12 w-12 rounded-full border-slate-950 bg-white hover:bg-white"
              >
                <img
                  src="https://cdn.shadcnstudio.com/ss-assets/brand-logo/linkedin-icon.png?width=20&height=20&format=auto"
                  alt="LinkedIn"
                  className="size-5"
                />
              </Button>
              <Button
                type="button"
                size="icon"
                onClick={() => {
                  if (navigator.share) {
                    void navigator.share({
                      title: `PathwayIQ report: ${report.career.title}`,
                      text: `My PathwayIQ report: ${report.career.title}`,
                      url: "https://pathwayiq.pages.dev",
                    });
                    return;
                  }

                  window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
                }}
                aria-label="Share to Instagram"
                title="Instagram"
                variant="outline"
                className="h-12 w-12 rounded-full border-slate-950 bg-white hover:bg-white"
              >
                <img
                  src="https://cdn.shadcnstudio.com/ss-assets/brand-logo/instagram-icon.png?width=20&height=20&format=auto"
                  alt="Instagram"
                  className="size-5"
                />
              </Button>
            </div>
          ) : null}

          <div className="h-8 w-px bg-slate-950/18" />

          <div className="flex items-center gap-3">
          <Button
            type="button"
            size="lg"
            onClick={() => onCompare(compareCareerId)}
            className="h-12 rounded-full border border-slate-950 bg-white px-5 text-sm font-semibold text-slate-950 shadow-none transition-all duration-200 hover:-translate-y-1 hover:bg-slate-950 hover:text-white hover:shadow-[0_18px_38px_rgba(15,23,42,0.2)] hover:ring-2 hover:ring-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
          >
            <Route className="h-4 w-4" />
            Compare roles
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onRestart}
            className="h-12 rounded-full border border-slate-950 bg-white px-5 text-sm font-semibold text-slate-950 shadow-none transition-all duration-200 hover:-translate-y-1 hover:bg-slate-950 hover:text-white hover:shadow-[0_18px_38px_rgba(15,23,42,0.2)] hover:ring-2 hover:ring-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950"
          >
            <ArrowRight className="h-4 w-4" />
            Start again
          </Button>
          </div>
        </div>
      </footer>
    </section>
  );
}
