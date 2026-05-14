"use client";

import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Download,
  ExternalLink,
  LineChart,
  Link2,
  Route,
  Share2,
  ShieldCheck,
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

interface NextStepCert {
  name: string;
  provider: string;
  cost: "Free" | "Paid";
  time: string;
  url: string;
}

interface NextStepGroup {
  name: string;
  platform: string;
  members: string;
  url: string;
}

interface StyleNextStepContent {
  certify: NextStepCert[];
  today: { action: string; url: string };
  connect: NextStepGroup[];
}

const STYLE_NEXT_STEP_CONTENT: Record<QuizDimensionId, StyleNextStepContent> = {
  builder: {
    certify: [
      { name: "AutoCAD Quick Start Guide", provider: "Autodesk Learning", cost: "Free", time: "~90 mins+", url: "https://www.autodesk.com/learn/ondemand/course/autocad-quick-start-guide" },
      { name: "Certificate III in Engineering - Mechanical Trade", provider: "Victoria University Polytechnic", cost: "Paid", time: "Apprenticeship", url: "https://www.vu.edu.au/courses/MEM30219" },
      { name: "First Aid Certificate", provider: "St John Ambulance", cost: "Paid", time: "1 day", url: "https://www.stjohnambulance.com.au/courses/first-aid/" },
    ],
    today: {
      action: "Open apprenticeships.gov.au, search your nearest city, and find 3 trade roles that sound interesting. Screenshot the ones that match — that's your shortlist.",
      url: "https://www.apprenticeships.gov.au/",
    },
    connect: [
      { name: "Engineers Australia — Students", platform: "Official network", members: "120k+ members", url: "https://www.engineersaustralia.org.au/students" },
      { name: "r/AusEngineers", platform: "Reddit", members: "28k members", url: "https://www.reddit.com/r/AusEngineers/" },
      { name: "BuildingTalent.com.au", platform: "Industry portal", members: "Industry hub", url: "https://www.buildingtalent.com.au/" },
      { name: "TradesMutt", platform: "Trades community", members: "Active forum", url: "https://www.tradesmutt.com/" },
    ],
  },
  decoder: {
    certify: [
      { name: "CyberStart America practice challenges", provider: "CyberStart", cost: "Free", time: "~20 hrs", url: "https://go.cyberstart.com/" },
      { name: "Google Cybersecurity Certificate", provider: "Coursera", cost: "Paid", time: "6 months", url: "https://www.coursera.org/professional-certificates/google-cybersecurity" },
      { name: "Python for Everybody", provider: "Coursera (free audit)", cost: "Free", time: "4 months", url: "https://www.coursera.org/specializations/python" },
    ],
    today: {
      action: "Go to cyberstart.com, create a free account, and complete the first two puzzles. Under 10 minutes — and it shows you what security analysis actually feels like.",
      url: "https://www.cyberstart.com/",
    },
    connect: [
      { name: "AustCyber Community", platform: "Industry body", members: "National network", url: "https://www.austcyber.com/" },
      { name: "r/netsec", platform: "Reddit", members: "530k members", url: "https://www.reddit.com/r/netsec/" },
      { name: "AISA — Australian Info Security", platform: "Professional association", members: "3k+ members", url: "https://www.aisa.org.au/" },
      { name: "Kaggle Community", platform: "Data science forum", members: "15M+ users", url: "https://www.kaggle.com/discussions" },
    ],
  },
  creator: {
    certify: [
      { name: "Google UX Design Certificate", provider: "Coursera", cost: "Paid", time: "6 months", url: "https://www.coursera.org/professional-certificates/google-ux-design" },
      { name: "Canva Design School", provider: "Canva", cost: "Free", time: "Self-paced", url: "https://www.canva.com/learn/design/" },
      { name: "Adobe Express Fundamentals", provider: "Adobe Education", cost: "Free", time: "~5 hrs", url: "https://www.adobe.com/express/learn/" },
    ],
    today: {
      action: "Open Figma.com (free account), pick your favourite app, and spend 10 minutes recreating its home screen. Save it — that's your first portfolio piece.",
      url: "https://www.figma.com/",
    },
    connect: [
      { name: "The Loop — Australian Design", platform: "Industry platform", members: "Creative community", url: "https://www.theloop.com.au/" },
      { name: "Behance", platform: "Adobe portfolio network", members: "50M+ creatives", url: "https://www.behance.net/" },
      { name: "r/userexperience", platform: "Reddit", members: "530k members", url: "https://www.reddit.com/r/userexperience/" },
      { name: "AGDA Australia", platform: "Design association", members: "Professional body", url: "https://www.agda.com.au/" },
    ],
  },
  guide: {
    certify: [
      { name: "Mental Health First Aid", provider: "MHFA Australia", cost: "Paid", time: "2 days", url: "https://mhfa.com.au/courses" },
      { name: "Introduction to Psychology", provider: "edX (free audit)", cost: "Free", time: "8 weeks", url: "https://www.edx.org/learn/psychology" },
      { name: "Child Safe Standards training", provider: "Australian Childhood Foundation", cost: "Paid", time: "Short course", url: "https://learn.childhood.org.au/trainings/" },
    ],
    today: {
      action: "Visit volunteer.com.au, enter your suburb, and find one local volunteering role in health, aged care, or youth support. Bookmark it to apply this week.",
      url: "https://www.volunteer.com.au/",
    },
    connect: [
      { name: "AASW — Social Workers", platform: "Professional association", members: "14k+ members", url: "https://www.aasw.asn.au/" },
      { name: "Youth Mental Health First Aid", platform: "MHFA network", members: "National network", url: "https://mhfa.com.au/youth" },
      { name: "r/nursing", platform: "Reddit", members: "360k members", url: "https://www.reddit.com/r/nursing/" },
      { name: "Health Careers Australia", platform: "Gov. portal", members: "Career resource", url: "https://www.healthcareers.hee.nhs.uk/" },
    ],
  },
  catalyst: {
    certify: [
      { name: "Google Digital Marketing & E-commerce", provider: "Coursera", cost: "Paid", time: "6 months", url: "https://www.coursera.org/professional-certificates/google-digital-marketing-ecommerce" },
      { name: "HubSpot Marketing Fundamentals", provider: "HubSpot Academy", cost: "Free", time: "~5 hrs", url: "https://academy.hubspot.com/" },
      { name: "Innovation & Entrepreneurship", provider: "Wharton / Coursera", cost: "Free", time: "4 weeks", url: "https://www.coursera.org/learn/wharton-entrepreneurship" },
    ],
    today: {
      action: "Write a 3-sentence pitch for a micro-business idea, then record a 60-second voice memo of yourself saying it out loud. That's your first pitch rep.",
      url: "https://www.theentourage.com.au/",
    },
    connect: [
      { name: "StartupAus", platform: "Industry body", members: "National network", url: "https://startupaus.org/" },
      { name: "The Entourage Community", platform: "Entrepreneur network", members: "500k+ members", url: "https://www.theentourage.com.au/" },
      { name: "r/entrepreneur", platform: "Reddit", members: "2.3M members", url: "https://www.reddit.com/r/entrepreneur/" },
      { name: "Young Entrepreneurs AU", platform: "Facebook Group", members: "Active community", url: "https://www.facebook.com/groups/youngentrepreneursaustralia/" },
    ],
  },
  strategist: {
    certify: [
      { name: "Excel for Business", provider: "Macquarie Uni / Coursera", cost: "Free", time: "4 months", url: "https://www.coursera.org/specializations/excel" },
      { name: "Intro to Operations Management", provider: "Wharton / Coursera", cost: "Free", time: "4 weeks", url: "https://www.coursera.org/learn/wharton-operations" },
      { name: "Project Management Essentials", provider: "TAFE NSW (online)", cost: "Paid", time: "6 weeks", url: "https://www.tafensw.edu.au/" },
    ],
    today: {
      action: "Download the free Notion app, pick the 'Student Planner' template, and map your next 30 days with 3 priority goals. Takes 10 minutes and builds a real planning habit.",
      url: "https://www.notion.so/templates/categories/student",
    },
    connect: [
      { name: "PMI Australia Chapter", platform: "Professional association", members: "Project managers", url: "https://www.pmi.org.au/" },
      { name: "r/projectmanagement", platform: "Reddit", members: "380k members", url: "https://www.reddit.com/r/projectmanagement/" },
      { name: "Australian Institute of Management", platform: "Learning community", members: "Business network", url: "https://www.aim.com.au/" },
      { name: "Atlassian Community", platform: "Work tools forum", members: "3M+ users", url: "https://community.atlassian.com/" },
    ],
  },
};

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

function LinkedInLogo() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function InstagramLogo() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="ig-grad-report" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="40%" stopColor="#e6683c" />
          <stop offset="70%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <path
        fill="url(#ig-grad-report)"
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
      />
    </svg>
  );
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
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
  const [copied, setCopied] = useState(false);
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
  const nextContent = STYLE_NEXT_STEP_CONTENT[reportStyleId];
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
      addText("01 Credentials", 12, "bold", 4);
      nextContent.certify.forEach((c) => addText(`${c.name} · ${c.provider} · ${c.cost} · ${c.time}`, 10, "normal", 4));
      addText("02 Try today — 10 minutes", 12, "bold", 8);
      addText(nextContent.today.action, 10, "normal", 8);
      addText("03 Communities", 12, "bold", 6);
      nextContent.connect.forEach((g) => addText(`${g.name} (${g.platform} · ${g.members})`, 10, "normal", 4));

      addText("Sources", 16, "bold", 10);
      report.dataSources.forEach((source) => addText(source, 10, "normal", 4));

      pdf.save(`pathwayiq-${safeFilename(report.career.title)}-report.pdf`);
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleCopyLink() {
    const url = "https://pathwayiq.pages.dev";
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      el.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function buildShareCard(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const size = 1080;
      const px = 84;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no canvas context")); return; }

      const bg = ctx.createLinearGradient(0, 0, 0, size);
      bg.addColorStop(0, "#0d1e2f");
      bg.addColorStop(0.55, "#091522");
      bg.addColorStop(1, "#060f1a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);

      const glow = ctx.createRadialGradient(size * 0.88, size * 0.12, 0, size * 0.88, size * 0.12, size * 0.6);
      glow.addColorStop(0, "rgba(15,139,141,0.26)");
      glow.addColorStop(1, "rgba(15,139,141,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = "#0f8b8d";
      ctx.fillRect(0, 0, size, 10);

      let y = 108;

      ctx.textBaseline = "top";
      ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#0f8b8d";
      ctx.fillText("PathwayIQ", px, y);
      y += 68;

      const badgeText = reportStyle.label.toUpperCase();
      ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
      const badgeW = ctx.measureText(badgeText).width + 52;
      ctx.fillStyle = "rgba(15,139,141,0.28)";
      fillRoundRect(ctx, px, y, badgeW, 52, 26);
      ctx.fillStyle = "rgba(15,139,141,0.72)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 26, y);
      ctx.lineTo(px + badgeW - 26, y);
      ctx.arcTo(px + badgeW, y, px + badgeW, y + 26, 26);
      ctx.lineTo(px + badgeW, y + 26);
      ctx.arcTo(px + badgeW, y + 52, px + badgeW - 26, y + 52, 26);
      ctx.lineTo(px + 26, y + 52);
      ctx.arcTo(px, y + 52, px, y + 26, 26);
      ctx.lineTo(px, y + 26);
      ctx.arcTo(px, y, px + 26, y, 26);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "#5cf5f5";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, px + 26, y + 26);
      y += 84;

      ctx.textBaseline = "top";
      const titleMaxW = size - px * 2;
      let titleFontSize = 94;
      ctx.font = `bold ${titleFontSize}px system-ui, -apple-system, sans-serif`;
      let titleLines = wrapCanvasText(ctx, report.career.title, titleMaxW);
      while (titleLines.length > 3 && titleFontSize > 60) {
        titleFontSize -= 6;
        ctx.font = `bold ${titleFontSize}px system-ui, -apple-system, sans-serif`;
        titleLines = wrapCanvasText(ctx, report.career.title, titleMaxW);
      }
      ctx.fillStyle = "#ffffff";
      const titleLineH = titleFontSize * 1.14;
      for (const line of titleLines) {
        ctx.fillText(line, px, y);
        y += titleLineH;
      }
      y += 28;

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(px, y, size - px * 2, 1.5);
      y += 44;

      ctx.font = "36px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.58)";
      const cardPathway = report.career.pathways[0]?.type ?? "TAFE";
      ctx.fillText(`${report.career.industry}  ·  ${cardPathway} pathway`, px, y);
      y += 60;

      ctx.font = "bold 52px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${formatSalary(report.career.salary.mid)} median`, px, y);
      y += 76;

      if (report.career.shortage) {
        ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#4ade80";
        ctx.fillText("✓  In Shortage — high demand", px, y);
      }

      const taglineY = size - 180;
      ctx.font = "italic 32px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      const taglineLines = wrapCanvasText(ctx, `"${reportStyle.tagline}"`, titleMaxW);
      let ty = taglineY;
      for (const line of taglineLines.slice(0, 2)) {
        ctx.fillText(line, px, ty);
        ty += 44;
      }

      ctx.font = "28px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillText("pathwayiq.pages.dev", px, size - 80);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvas toBlob returned null"));
      }, "image/png", 1.0);
    });
  }

  async function handleShareInstagram() {
    const blob = await buildShareCard().catch(() => null);
    if (!blob) return;

    const filename = `pathwayiq-${safeFilename(report.career.title)}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    // Mobile: Web Share API with files → native share sheet → user picks Instagram
    // iOS 15+, Android Chrome 86+ pass the file into the app's share flow
    if (
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: `My career path: ${report.career.title}`,
          text: "Exploring my career path on PathwayIQ 🎯",
        });
        return;
      } catch (err) {
        // User dismissed the share sheet — don't fall through
        if ((err as Error).name === "AbortError") return;
      }
    }

    // Desktop: download the image, then open Instagram so they can post it
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = filename;
    a.href = objectUrl;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    // Brief delay so the download starts before the new tab opens
    setTimeout(() => {
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    }, 700);
  }

  async function handleShareLinkedIn() {
    // Download the share card first so the user can attach it to the post
    const blob = await buildShareCard().catch(() => null);
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `pathwayiq-${safeFilename(report.career.title)}.png`;
      a.href = objectUrl;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }

    // Open LinkedIn post composer with pre-filled text
    // linkedin.com/feed/?shareActive=true&text= opens the post box directly
    const postText = [
      `Just explored my career path: ${report.career.title}`,
      "",
      `${report.career.industry} · ${report.career.pathways[0]?.type ?? "TAFE"} pathway`,
      `${formatSalary(report.career.salary.mid)} median salary${report.career.shortage ? " · In Shortage" : ""}`,
      "",
      "Found on PathwayIQ — career guidance for Victorian Year 10–12 students 🎯",
      "https://pathwayiq.pages.dev",
    ].join("\n");

    setTimeout(() => {
      window.open(
        `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(postText)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }, 700);
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
              <div className="mb-5 flex items-center gap-3">
                <Target className="h-5 w-5 text-[#0f8b8d]" />
                <h3 className="text-xl font-semibold text-slate-950">Your next move</h3>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {/* 01 Credentials */}
                <div className="overflow-hidden rounded-[18px] border border-slate-200">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-100">01</div>
                    <div className="mt-0.5 text-base font-bold text-white">Credentials</div>
                    <div className="mt-0.5 text-[11px] text-amber-100/80">Verified courses and certificates</div>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white">
                    {nextContent.certify.map((cert) => (
                      <a
                        key={cert.name}
                        href={cert.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3.5 transition hover:bg-amber-50/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900">{cert.name}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{cert.provider}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                cert.cost === "Free"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {cert.cost}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                              {cert.time}
                            </span>
                          </div>
                        </div>
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                      </a>
                    ))}
                  </div>
                </div>

                {/* 02 Today */}
                <div className="overflow-hidden rounded-[18px] border border-slate-200">
                  <div className="bg-gradient-to-r from-teal-600 to-cyan-500 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-teal-100">02</div>
                    <div className="mt-0.5 text-base font-bold text-white">Try today</div>
                    <div className="mt-0.5 text-[11px] text-teal-100/80">One action — right now</div>
                  </div>
                  <div className="bg-white p-4">
                    <div className="rounded-[14px] bg-gradient-to-br from-teal-50 to-cyan-50 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-teal-600">10 minutes</div>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{nextContent.today.action}</p>
                      <a
                        href={nextContent.today.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 transition hover:text-teal-700"
                      >
                        Start here <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* 03 Connect */}
                <div className="overflow-hidden rounded-[18px] border border-slate-200">
                  <div className="bg-gradient-to-r from-violet-600 to-purple-500 px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-200">03</div>
                    <div className="mt-0.5 text-base font-bold text-white">Communities</div>
                    <div className="mt-0.5 text-[11px] text-violet-200/80">Reliable places to learn from others</div>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white">
                    {nextContent.connect.map((group) => (
                      <a
                        key={group.name}
                        href={group.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3.5 transition hover:bg-violet-50/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900">{group.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">{group.platform}</span>
                            <span className="text-slate-200">·</span>
                            <span className="text-xs font-medium text-slate-500">{group.members}</span>
                          </div>
                        </div>
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                      </a>
                    ))}
                  </div>
                </div>
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
          <div className="flex items-center gap-2">
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

            {shareOpen ? (
              <>
                <div className="h-8 w-px bg-slate-950/20" />
                <button
                  type="button"
                  title="Share on LinkedIn — opens post composer with text pre-filled"
                  onClick={() => void handleShareLinkedIn()}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-950 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(10,102,194,0.22)]"
                >
                  <LinkedInLogo />
                </button>
                <button
                  type="button"
                  title={copied ? "Copied!" : "Copy link"}
                  onClick={() => void handleCopyLink()}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-950 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(15,23,42,0.22)]"
                >
                  {copied
                    ? <Check className="h-5 w-5 text-emerald-600" />
                    : <Link2 className="h-5 w-5 text-slate-700" />}
                </button>
                <button
                  type="button"
                  title="Share to Instagram"
                  onClick={() => void handleShareInstagram()}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-950 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(188,24,136,0.22)]"
                >
                  <InstagramLogo />
                </button>
              </>
            ) : null}
          </div>

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
