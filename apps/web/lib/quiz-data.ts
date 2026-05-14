import { INTEREST_TAGS } from "@/lib/career-data";
import careerCardsData from "../public/data2/career-cards.json";

export type QuizModeId = "quick" | "deep";

export type QuizDimensionId =
  | "builder"
  | "decoder"
  | "creator"
  | "guide"
  | "catalyst"
  | "strategist";

export interface QuizModeDefinition {
  id: QuizModeId;
  title: string;
  duration: string;
  questionCount: number;
  blurb: string;
  helper: string;
}

export interface QuizDimensionDefinition {
  id: QuizDimensionId;
  label: string;
  tagline: string;
  summary: string;
  colorClassName: string;
  lightCardColorClassName: string;
  surfaceClassName: string;
  illustrationSrc: string;
  exploreInterest: (typeof INTEREST_TAGS)[number] | null;
  exploreSearch: string;
  workLikes: string[];
}

export interface QuizCareerRecommendation {
  title: string;
  pathway: string;
  industry: string;
  anzsco_code: string;
  median_salary: number;
  shortage_status: string;
  fitLabel: string;
  visualStyleId: QuizDimensionId;
}

export interface QuizQuestionOption {
  id: string;
  label: string;
  helper: string;
  weights: Partial<Record<QuizDimensionId, number>>;
}

export interface QuizQuestion {
  id: string;
  mode: QuizModeId;
  prompt: string;
  helper: string;
  options: QuizQuestionOption[];
}

export interface QuizScoreBreakdown {
  dimension: QuizDimensionId;
  label: string;
  score: number;
  percent: number;
}

export interface QuizResult {
  mode: QuizModeId;
  totalQuestions: number;
  archetypeTitle: string;
  archetypeSummary: string;
  topStyle: QuizDimensionDefinition;
  supportStyle: QuizDimensionDefinition;
  supportStyle2?: QuizDimensionDefinition; // deep mode only — second support style
  scoreBreakdown: QuizScoreBreakdown[];
  recommendedCareers: QuizCareerRecommendation[];
  exploreInterest: (typeof INTEREST_TAGS)[number] | null;
  exploreSearch: string;
}

export type QuizAnswerMap = Record<string, string[]>;

interface QuizCareerDatasetRecord {
  title: string;
  pathway: string;
  industry: string;
  anzsco_code: string;
  median_salary: number;
  shortage_status: string;
}

interface QuizCareerFitRule {
  industries?: string[];
  pathways?: string[];
  titleKeywords?: string[];
}

interface QuizCareerScoredRecord extends QuizCareerDatasetRecord {
  __styleScores: Record<QuizDimensionId, number>;
  __styleTags: QuizDimensionId[];
  __primaryStyleId: QuizDimensionId;
  __quizScore: number;
}

const QUIZ_CAREER_DATA = careerCardsData as QuizCareerDatasetRecord[];

export const QUIZ_MODES: QuizModeDefinition[] = [
  {
    id: "quick",
    title: "Quick Match",
    duration: "6 questions · about 1 minute",
    questionCount: 6,
    blurb: "A fast vibe check — pick up to 2 answers per question. No pressure to commit to just one.",
    helper: "Best when you want a quick starting point before diving into career cards.",
  },
  {
    id: "deep",
    title: "Deep Match",
    duration: "12 questions · about 3 minutes",
    questionCount: 12,
    blurb: "One answer per question, but you earn two support styles and four matched career cards as your reward.",
    helper: "Best when you want a fuller result before checking uni, TAFE, or apprenticeship options.",
  },
] as const;

export const QUIZ_DIMENSIONS: Record<QuizDimensionId, QuizDimensionDefinition> = {
  builder: {
    id: "builder",
    label: "Maker",
    tagline: "You like making useful things happen in the real world.",
    summary:
      "Maker answers usually point toward practical, hands-on work where progress is visible and tools, systems, or physical spaces matter.",
    colorClassName: "text-cyan-200",
    lightCardColorClassName: "text-cyan-700",
    surfaceClassName: "border-cyan-400/24 bg-cyan-400/10",
    illustrationSrc: "/quiz-styles/maker.svg",
    exploreInterest: "Hands-on Trades",
    exploreSearch: "electrician",
    workLikes: ["hands-on progress", "field-based work", "real-world problem solving"],
  },
  decoder: {
    id: "decoder",
    label: "Solver",
    tagline: "You like patterns, systems, and working out what is really going on.",
    summary:
      "Solver answers often fit roles where logic, investigation, and analysis help turn complexity into clear decisions.",
    colorClassName: "text-violet-200",
    lightCardColorClassName: "text-violet-700",
    surfaceClassName: "border-violet-400/24 bg-violet-400/10",
    illustrationSrc: "/quiz-styles/solver.svg",
    exploreInterest: "Data & AI",
    exploreSearch: "data",
    workLikes: ["logic and patterns", "structured challenges", "figuring things out"],
  },
  creator: {
    id: "creator",
    label: "Creator",
    tagline: "You like shaping ideas into something people can actually use or feel.",
    summary:
      "Creator answers lean toward design, innovation, and expressive work where ideas, storytelling, and experimentation matter.",
    colorClassName: "text-fuchsia-200",
    lightCardColorClassName: "text-fuchsia-700",
    surfaceClassName: "border-pink-400/24 bg-pink-400/10",
    illustrationSrc: "/quiz-styles/creator.svg",
    exploreInterest: "Creative Problem Solving",
    exploreSearch: "designer",
    workLikes: ["new ideas", "creative systems", "turning concepts into outcomes"],
  },
  guide: {
    id: "guide",
    label: "Guide",
    tagline: "You care about helping people move through real challenges well.",
    summary:
      "Guide answers point toward people-centred work where support, communication, and trust are central to doing the job well.",
    colorClassName: "text-emerald-200",
    lightCardColorClassName: "text-emerald-700",
    surfaceClassName: "border-emerald-400/24 bg-emerald-400/10",
    illustrationSrc: "/quiz-styles/guide.svg",
    exploreInterest: "Healthcare",
    exploreSearch: "nurse",
    workLikes: ["helping people", "clear communication", "steady support"],
  },
  catalyst: {
    id: "catalyst",
    label: "Leader",
    tagline: "You like momentum, influence, and being the person who gets things moving.",
    summary:
      "Leader answers often fit roles where initiative, persuasion, and fast decision-making help teams make progress.",
    colorClassName: "text-amber-200",
    lightCardColorClassName: "text-amber-700",
    surfaceClassName: "border-amber-400/24 bg-amber-400/10",
    illustrationSrc: "/quiz-styles/leader.svg",
    exploreInterest: "Cybersecurity",
    exploreSearch: "security",
    workLikes: ["momentum and action", "influence", "high-energy decisions"],
  },
  strategist: {
    id: "strategist",
    label: "Planner",
    tagline: "You like structure, sequencing, and building plans that actually hold up.",
    summary:
      "Planner answers suit work where priorities, systems thinking, and long-range planning help teams avoid chaos.",
    colorClassName: "text-sky-200",
    lightCardColorClassName: "text-sky-700",
    surfaceClassName: "border-sky-400/24 bg-sky-400/10",
    illustrationSrc: "/quiz-styles/planner.svg",
    exploreInterest: "Data & AI",
    exploreSearch: "manager",
    workLikes: ["planning ahead", "systems and structure", "steady execution"],
  },
};

const STYLE_FIT_RULES: Record<QuizDimensionId, QuizCareerFitRule> = {
  builder: {
    industries: ["Engineering", "Construction", "Agriculture & Environment", "Healthcare"],
    pathways: ["Apprenticeship", "TAFE"],
    titleKeywords: [
      "electrician",
      "plumber",
      "bricklayer",
      "carpenter",
      "mechanic",
      "technician",
      "maintenance",
      "engineer",
      "cabler",
    ],
  },
  decoder: {
    industries: ["Technology", "Engineering", "Business", "Science"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: [
      "analyst",
      "developer",
      "programmer",
      "software",
      "ict",
      "data",
      "policy",
      "quality",
      "engineer",
    ],
  },
  creator: {
    industries: ["Creative Industries", "Technology", "Education", "Construction", "Business"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: [
      "designer",
      "marketing",
      "graphic",
      "interior",
      "architectural",
      "draftsperson",
      "developer",
      "teacher",
    ],
  },
  guide: {
    industries: ["Healthcare", "Community Services", "Education"],
    pathways: ["TAFE"],
    titleKeywords: [
      "nurse",
      "teacher",
      "care",
      "community",
      "health",
      "counsell",
      "aide",
      "worker",
      "educator",
    ],
  },
  catalyst: {
    industries: ["Business", "Technology", "Engineering", "Construction"],
    pathways: ["TAFE", "Apprenticeship"],
    titleKeywords: [
      "manager",
      "project",
      "sales",
      "marketing",
      "executive",
      "lead",
      "company",
      "transport",
      "engineer",
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
      "quality",
      "office",
      "practice",
      "engineer",
    ],
  },
};

const STYLE_PAIR_FIT_RULES: Partial<Record<`${QuizDimensionId}:${QuizDimensionId}`, QuizCareerFitRule>> = {
  "builder:guide": {
    industries: ["Healthcare", "Community Services", "Construction"],
    titleKeywords: ["ambulance", "nurse", "health", "care", "technician"],
  },
  "builder:strategist": {
    industries: ["Engineering", "Construction", "Business"],
    titleKeywords: ["project", "manager", "engineer", "estimator", "technician"],
  },
  "decoder:creator": {
    industries: ["Technology", "Creative Industries", "Business"],
    titleKeywords: ["designer", "developer", "software", "graphic", "ict", "programmer"],
  },
  "decoder:strategist": {
    industries: ["Technology", "Business", "Science"],
    titleKeywords: ["analyst", "manager", "policy", "project", "ict", "quality"],
  },
  "creator:guide": {
    industries: ["Education", "Community Services", "Creative Industries"],
    titleKeywords: ["teacher", "designer", "child", "community", "trainer", "educator"],
  },
  "creator:catalyst": {
    industries: ["Creative Industries", "Business", "Technology"],
    titleKeywords: ["marketing", "designer", "manager", "project", "developer"],
  },
  "guide:strategist": {
    industries: ["Healthcare", "Education", "Community Services"],
    titleKeywords: ["nurse", "teacher", "manager", "educator", "welfare", "practice"],
  },
  "catalyst:decoder": {
    industries: ["Technology", "Business", "Engineering"],
    titleKeywords: ["manager", "analyst", "ict", "software", "engineer", "quality"],
  },
  "catalyst:builder": {
    industries: ["Engineering", "Construction", "Business"],
    titleKeywords: ["manager", "engineer", "project", "electrician", "technician"],
  },
  "strategist:guide": {
    industries: ["Healthcare", "Education", "Community Services"],
    titleKeywords: ["nurse", "teacher", "manager", "educator", "welfare", "practice"],
  },
};

function getIndustryScore(industries: string[] | undefined, value: string, base: number) {
  if (!industries) {
    return 0;
  }

  const matchIndex = industries.findIndex((industry) => industry === value);
  if (matchIndex === -1) {
    return 0;
  }

  return Math.max(base - matchIndex * 6, Math.round(base * 0.45));
}

function getPathwayScore(pathways: string[] | undefined, value: string, base: number) {
  if (!pathways || !pathways.includes(value)) {
    return 0;
  }

  return base;
}

function getKeywordScore(titleKeywords: string[] | undefined, title: string, base: number) {
  if (!titleKeywords) {
    return 0;
  }

  const normalizedTitle = title.toLowerCase();
  const matches = titleKeywords.filter((keyword) => normalizedTitle.includes(keyword.toLowerCase()));
  return Math.min(matches.length, 3) * base;
}

function getQuizCareerScore(
  career: QuizCareerDatasetRecord,
  topStyle: QuizDimensionDefinition,
  supportStyle: QuizDimensionDefinition,
) {
  const topRule = STYLE_FIT_RULES[topStyle.id];
  const supportRule = STYLE_FIT_RULES[supportStyle.id];
  const pairRule = STYLE_PAIR_FIT_RULES[`${topStyle.id}:${supportStyle.id}`];

  let score = 0;

  score += getIndustryScore(topRule.industries, career.industry, 34);
  score += getIndustryScore(supportRule.industries, career.industry, 18);
  score += getIndustryScore(pairRule?.industries, career.industry, 22);

  score += getPathwayScore(topRule.pathways, career.pathway, 18);
  score += getPathwayScore(supportRule.pathways, career.pathway, 8);
  score += getPathwayScore(pairRule?.pathways, career.pathway, 10);

  score += getKeywordScore(topRule.titleKeywords, career.title, 8);
  score += getKeywordScore(supportRule.titleKeywords, career.title, 4);
  score += getKeywordScore(pairRule?.titleKeywords, career.title, 6);

  if (/^in shortage$/i.test(career.shortage_status)) {
    score += 8;
  }

  score += Math.min(10, Math.round(career.median_salary / 20000));

  return score;
}

function getFitLabel(topStyle: QuizDimensionDefinition, supportStyle: QuizDimensionDefinition) {
  return `${topStyle.label} + ${supportStyle.label} fit`;
}

function getSingleStyleCareerScore(
  career: QuizCareerDatasetRecord,
  style: QuizDimensionDefinition,
) {
  const rule = STYLE_FIT_RULES[style.id];

  let score = 0;
  score += getIndustryScore(rule.industries, career.industry, 28);
  score += getPathwayScore(rule.pathways, career.pathway, 14);
  score += getKeywordScore(rule.titleKeywords, career.title, 7);
  return score;
}

function getRankedStyleScores(career: QuizCareerDatasetRecord) {
  return (Object.values(QUIZ_DIMENSIONS) as QuizDimensionDefinition[])
    .map((style) => ({
      id: style.id,
      score: getSingleStyleCareerScore(career, style),
    }))
    .sort((left, right) => right.score - left.score);
}

function inferCareerStyleTags(
  rankedScores: { id: QuizDimensionId; score: number }[],
): QuizDimensionId[] {
  const bestScore = rankedScores[0]?.score ?? 0;
  if (bestScore <= 0) {
    return ["strategist"];
  }

  const tags = rankedScores
    .filter((entry, index) => {
      if (index === 0) {
        return true;
      }

      if (index === 1) {
        return entry.score >= Math.max(12, bestScore - 10);
      }

      if (index === 2) {
        return entry.score >= Math.max(14, Math.round(bestScore * 0.68));
      }

      return false;
    })
    .map((entry) => entry.id);

  return tags.slice(0, 3);
}

function getCareerStyleProfile(career: QuizCareerDatasetRecord) {
  const rankedScores = getRankedStyleScores(career);
  const styleScores = rankedScores.reduce<Record<QuizDimensionId, number>>((acc, entry) => {
    acc[entry.id] = entry.score;
    return acc;
  }, {} as Record<QuizDimensionId, number>);

  const styleTags = inferCareerStyleTags(rankedScores);
  const primaryStyleId = styleTags[0] ?? rankedScores[0]?.id ?? "strategist";

  return {
    styleScores,
    styleTags,
    primaryStyleId,
  };
}

function getRecommendationVisualStyleId(
  career: QuizCareerScoredRecord,
  topStyle: QuizDimensionDefinition,
  supportStyle: QuizDimensionDefinition,
  supportStyle2: QuizDimensionDefinition | undefined,
  index: number,
): QuizDimensionId {
  if (index === 3 && supportStyle2) {
    return supportStyle2.id;
  }

  if (index < 2) {
    return topStyle.id;
  }

  const topScore = career.__styleScores[topStyle.id] ?? 0;
  const supportScore = career.__styleScores[supportStyle.id] ?? 0;

  const isClearlySupportLed =
    career.__primaryStyleId === supportStyle.id ||
    (supportScore >= topScore + 8 && career.__styleTags.includes(supportStyle.id));

  if (isClearlySupportLed) {
    return supportStyle.id;
  }

  return topStyle.id;
}

function getCompositeQuizCareerScore(
  career: QuizCareerDatasetRecord,
  topStyle: QuizDimensionDefinition,
  supportStyle: QuizDimensionDefinition,
) {
  const styleProfile = getCareerStyleProfile(career);
  const pairRule = STYLE_PAIR_FIT_RULES[`${topStyle.id}:${supportStyle.id}`];

  let score = 0;

  const topScore = styleProfile.styleScores[topStyle.id] ?? 0;
  const supportScore = styleProfile.styleScores[supportStyle.id] ?? 0;

  score += topScore * 2.8;
  score += supportScore * 1.6;

  if (styleProfile.primaryStyleId === topStyle.id) {
    score += 42;
  }

  if (styleProfile.primaryStyleId === supportStyle.id) {
    score += 18;
  }

  if (styleProfile.styleTags.includes(topStyle.id)) {
    score += 28;
  }

  if (styleProfile.styleTags.includes(supportStyle.id)) {
    score += 18;
  }

  if (
    styleProfile.styleTags.includes(topStyle.id) &&
    styleProfile.styleTags.includes(supportStyle.id)
  ) {
    score += 26;
  }

  score += getIndustryScore(pairRule?.industries, career.industry, 18);
  score += getPathwayScore(pairRule?.pathways, career.pathway, 10);
  score += getKeywordScore(pairRule?.titleKeywords, career.title, 6);

  if (/^in shortage$/i.test(career.shortage_status)) {
    score += 8;
  }

  score += Math.min(10, Math.round(career.median_salary / 20000));

  return {
    styleProfile,
    score,
  };
}

function getRecommendedCareers(
  topStyle: QuizDimensionDefinition,
  supportStyle: QuizDimensionDefinition,
  count: number = 3,
  supportStyle2?: QuizDimensionDefinition,
): QuizCareerRecommendation[] {
  const scoredCareers: QuizCareerScoredRecord[] = QUIZ_CAREER_DATA.map((career) => {
    const { styleProfile, score } = getCompositeQuizCareerScore(career, topStyle, supportStyle);

    return {
      ...career,
      __styleScores: styleProfile.styleScores,
      __styleTags: styleProfile.styleTags,
      __primaryStyleId: styleProfile.primaryStyleId,
      __quizScore: score,
    };
  }).sort((left, right) => {
    if (right.__quizScore !== left.__quizScore) {
      return right.__quizScore - left.__quizScore;
    }

    if (left.shortage_status !== right.shortage_status) {
      return /^in shortage$/i.test(left.shortage_status) ? -1 : 1;
    }

    if (right.median_salary !== left.median_salary) {
      return right.median_salary - left.median_salary;
    }

    return left.title.localeCompare(right.title);
  });

  const chosen: QuizCareerScoredRecord[] = [];
  const usedTitles = new Set<string>();

  const pushIfAvailable = (career: QuizCareerScoredRecord | undefined) => {
    if (!career || usedTitles.has(career.title) || chosen.length >= count) {
      return;
    }
    chosen.push(career);
    usedTitles.add(career.title);
  };

  const topStylePool = scoredCareers.filter((career) => career.__styleTags.includes(topStyle.id));
  const supportOnlyPool = scoredCareers.filter(
    (career) =>
      career.__styleTags.includes(supportStyle.id) && !career.__styleTags.includes(topStyle.id),
  );
  const blendedPool = scoredCareers.filter(
    (career) =>
      career.__styleTags.includes(topStyle.id) && career.__styleTags.includes(supportStyle.id),
  );

  pushIfAvailable(blendedPool[0] ?? topStylePool[0]);
  pushIfAvailable(topStylePool.find((career) => !usedTitles.has(career.title)));

  const supportCandidate = supportOnlyPool[0];
  const fallbackCandidate = scoredCareers.find((career) => !usedTitles.has(career.title));
  pushIfAvailable(supportCandidate ?? fallbackCandidate);

  if (count >= 4 && supportStyle2) {
    const support2Pool = scoredCareers.filter(
      (career) => career.__styleTags.includes(supportStyle2.id) && !usedTitles.has(career.title),
    );
    pushIfAvailable(support2Pool[0] ?? scoredCareers.find((career) => !usedTitles.has(career.title)));
  }

  while (chosen.length < count) {
    const next = scoredCareers.find((career) => !usedTitles.has(career.title));
    if (!next) break;
    pushIfAvailable(next);
  }

  return chosen.map((career, index) => ({
    title: career.title,
    pathway: career.pathway,
    industry: career.industry,
    anzsco_code: career.anzsco_code,
    median_salary: career.median_salary,
    shortage_status: career.shortage_status,
    fitLabel:
      index === 3 && supportStyle2
        ? `${supportStyle2.label} match`
        : career.__primaryStyleId === supportStyle.id && !career.__styleTags.includes(topStyle.id)
          ? `${supportStyle.label}-led fit`
          : getFitLabel(topStyle, supportStyle),
    visualStyleId: getRecommendationVisualStyleId(career, topStyle, supportStyle, supportStyle2, index),
  }));
}

const makeOptions = (
  builder: string,
  decoder: string,
  creator: string,
  guide: string,
): QuizQuestionOption[] => [
  {
    id: "a",
    label: builder,
    helper: "Hands-on, practical, gets moving fast",
    weights: { builder: 3, catalyst: 1 },
  },
  {
    id: "b",
    label: decoder,
    helper: "Analytical, curious, pattern-focused",
    weights: { decoder: 3, strategist: 1 },
  },
  {
    id: "c",
    label: creator,
    helper: "Creative, expressive, idea-led",
    weights: { creator: 3, catalyst: 1 },
  },
  {
    id: "d",
    label: guide,
    helper: "People-first, supportive, human-centred",
    weights: { guide: 3, strategist: 1 },
  },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "quick-1",
    mode: "quick",
    prompt: "Your class gets dropped into a last-minute showcase project. What role do you grab first?",
    helper: "Choose the one you would naturally jump into before anyone starts assigning jobs.",
    options: makeOptions(
      "Get the setup sorted and build something that actually works",
      "Figure out the pattern, data, or logic behind the challenge",
      "Shape the concept, aesthetic, or pitch so it stands out",
      "Keep the group calm, organised, and feeling backed up",
    ),
  },
  {
    id: "quick-2",
    mode: "quick",
    prompt: "What kind of win gives you the biggest “that was worth it” feeling?",
    helper: "Think about the kind of result that would make you message the group chat about it later.",
    options: makeOptions(
      "Something real, useful, or practical works properly now",
      "I cracked a tricky problem other people were stuck on",
      "An idea came to life and people instantly noticed it",
      "Someone felt more confident or supported because I helped",
    ),
  },
  {
    id: "quick-3",
    mode: "quick",
    prompt: "You suddenly get a free afternoon after school. What sounds most fun to explore?",
    helper: "Go with what genuinely pulls you in, not what sounds most impressive.",
    options: makeOptions(
      "Trying tools, fixing something, building, or testing gear",
      "Digging into a mystery, strategy, or how a system really works",
      "Designing, filming, sketching, writing, or brainstorming ideas",
      "Helping people, coaching someone, or checking in properly",
    ),
  },
  {
    id: "quick-4",
    mode: "quick",
    prompt: "Which kind of school task drains you the least?",
    helper: "This is really asking what you can stay focused on longest without getting bored.",
    options: makeOptions(
      "Workshops, labs, setups, or practical build tasks",
      "Research, maths, logic puzzles, or spreadsheet-style work",
      "Presentations, visuals, campaigns, or concept development",
      "Tutoring, team support, or wellbeing-focused activities",
    ),
  },
  {
    id: "quick-5",
    mode: "quick",
    prompt: "Your friends or classmates usually come to you when they need...",
    helper: "Think about the role you already play without trying too hard.",
    options: [
      {
        id: "a",
        label: "Someone who can jump in and make something actually happen",
        helper: "Action-oriented, practical, fast-moving",
        weights: { builder: 2, catalyst: 2 },
      },
      {
        id: "b",
        label: "Someone who can explain what is really going on",
        helper: "Analytical, calm, evidence-led",
        weights: { decoder: 2, strategist: 2 },
      },
      {
        id: "c",
        label: "A fresh angle, cool idea, or more interesting approach",
        helper: "Imaginative, expressive, lateral",
        weights: { creator: 2, catalyst: 2 },
      },
      {
        id: "d",
        label: "Someone who listens properly and keeps people steady",
        helper: "Supportive, clear, reassuring",
        weights: { guide: 2, strategist: 2 },
      },
    ],
  },
  {
    id: "quick-6",
    mode: "quick",
    prompt: "If a future job felt genuinely right for you, what would it probably include?",
    helper: "Choose the strongest signal, even if more than one sounds good.",
    options: [
      {
        id: "a",
        label: "Visible progress, movement, and a real-world outcome",
        helper: "Builder",
        weights: { builder: 3, strategist: 1 },
      },
      {
        id: "b",
        label: "Complex systems, patterns, or things to figure out",
        helper: "Decoder",
        weights: { decoder: 3, creator: 1 },
      },
      {
        id: "c",
        label: "Ideas, design choices, and room to shape the direction",
        helper: "Creator",
        weights: { creator: 3, catalyst: 1 },
      },
      {
        id: "d",
        label: "People, trust, and a real impact on someone’s day",
        helper: "Guide",
        weights: { guide: 3, catalyst: 1 },
      },
    ],
  },
  {
    id: "deep-1",
    mode: "deep",
    prompt: "In a group task or event, where do you naturally become useful first?",
    helper: "Think about what you start doing before anyone even gives out roles.",
    options: [
      {
        id: "a",
        label: "I get things moving so the group does not stay stuck in planning mode",
        helper: "Catalyst",
        weights: { catalyst: 3, builder: 1 },
      },
      {
        id: "b",
        label: "I map out the plan so everyone stops guessing",
        helper: "Strategist",
        weights: { strategist: 3, decoder: 1 },
      },
      {
        id: "c",
        label: "I shape the direction so it feels sharper, cooler, or more original",
        helper: "Creator",
        weights: { creator: 3, decoder: 1 },
      },
      {
        id: "d",
        label: "I notice what people need so the whole group works better",
        helper: "Guide",
        weights: { guide: 3, catalyst: 1 },
      },
    ],
  },
  {
    id: "deep-2",
    mode: "deep",
    prompt: "What kind of challenge keeps you hooked longer than it does for most people?",
    helper: "Choose the one you would still care about after the easy part wears off.",
    options: makeOptions(
      "A practical task that needs patience, tools, and follow-through",
      "A system, case, or puzzle that needs deep thinking",
      "An idea that could become more interesting, human, or memorable",
      "A situation where people need support, guidance, or reassurance",
    ),
  },
  {
    id: "deep-3",
    mode: "deep",
    prompt: "If a teacher gave you total freedom for a major final project, what would you base it on?",
    helper: "Imagine you are choosing by interest, not by what would get the safest mark.",
    options: [
      {
        id: "a",
        label: "A working solution, prototype, or hands-on demonstration",
        helper: "Builder",
        weights: { builder: 3, creator: 1 },
      },
      {
        id: "b",
        label: "A research-driven case with findings and a strong answer",
        helper: "Decoder",
        weights: { decoder: 3, strategist: 1 },
      },
      {
        id: "c",
        label: "A campaign, concept, or designed experience",
        helper: "Creator",
        weights: { creator: 3, catalyst: 1 },
      },
      {
        id: "d",
        label: "A practical guide, service, or support resource for real people",
        helper: "Guide",
        weights: { guide: 3, strategist: 1 },
      },
    ],
  },
  {
    id: "deep-4",
    mode: "deep",
    prompt: "When something is going badly, what do you notice first?",
    helper: "This shows what your attention naturally locks onto under pressure.",
    options: [
      {
        id: "a",
        label: "The part that is physically broken or just not working",
        helper: "Builder",
        weights: { builder: 3, decoder: 1 },
      },
      {
        id: "b",
        label: "The weak logic or hidden reason underneath it",
        helper: "Decoder",
        weights: { decoder: 3, strategist: 1 },
      },
      {
        id: "c",
        label: "The experience feels confusing, bland, or badly designed",
        helper: "Creator",
        weights: { creator: 3, guide: 1 },
      },
      {
        id: "d",
        label: "People are stressed, disconnected, or unsupported",
        helper: "Guide",
        weights: { guide: 3, catalyst: 1 },
      },
    ],
  },
  {
    id: "deep-5",
    mode: "deep",
    prompt: "Which compliment feels most accurate when someone says it about you?",
    helper: "Pick the one that makes you think, “Yep, that’s me on a good day.”",
    options: [
      {
        id: "a",
        label: "You actually get things done",
        helper: "Builder / Catalyst",
        weights: { builder: 2, catalyst: 2 },
      },
      {
        id: "b",
        label: "You notice things other people miss",
        helper: "Decoder / Strategist",
        weights: { decoder: 2, strategist: 2 },
      },
      {
        id: "c",
        label: "You always come up with a better angle",
        helper: "Creator / Catalyst",
        weights: { creator: 2, catalyst: 2 },
      },
      {
        id: "d",
        label: "You make people feel calm, safe, and clear",
        helper: "Guide / Strategist",
        weights: { guide: 2, strategist: 2 },
      },
    ],
  },
  {
    id: "deep-6",
    mode: "deep",
    prompt: "Which kind of work environment sounds most natural to you?",
    helper: "Ignore status and prestige. Just pick by genuine fit.",
    options: [
      {
        id: "a",
        label: "Active, practical, on-site, or tool-based",
        helper: "Builder",
        weights: { builder: 3, catalyst: 1 },
      },
      {
        id: "b",
        label: "Focused, technical, and mentally demanding",
        helper: "Decoder",
        weights: { decoder: 3, strategist: 1 },
      },
      {
        id: "c",
        label: "Open-ended, expressive, and design-led",
        helper: "Creator",
        weights: { creator: 3, guide: 1 },
      },
      {
        id: "d",
        label: "People-facing, supportive, and meaningful",
        helper: "Guide",
        weights: { guide: 3, builder: 1 },
      },
    ],
  },
  {
    id: "deep-7",
    mode: "deep",
    prompt: "When you picture your future after school, which feeling matters most?",
    helper: "This is about the energy you want from work, not a specific job title.",
    options: [
      {
        id: "a",
        label: "I want to feel capable and useful",
        helper: "Builder",
        weights: { builder: 3, strategist: 1 },
      },
      {
        id: "b",
        label: "I want to feel sharp and challenged",
        helper: "Decoder",
        weights: { decoder: 3, catalyst: 1 },
      },
      {
        id: "c",
        label: "I want to feel expressive and original",
        helper: "Creator",
        weights: { creator: 3, guide: 1 },
      },
      {
        id: "d",
        label: "I want to feel helpful and trusted",
        helper: "Guide",
        weights: { guide: 3, strategist: 1 },
      },
    ],
  },
  {
    id: "deep-8",
    mode: "deep",
    prompt: "What kind of responsibility sounds most exciting to you?",
    helper: "This helps separate what you enjoy from what you would actually want to own.",
    options: [
      {
        id: "a",
        label: "Owning delivery and making sure something actually gets built",
        helper: "Builder / Catalyst",
        weights: { builder: 2, catalyst: 2 },
      },
      {
        id: "b",
        label: "Owning the structure, roadmap, or decision logic",
        helper: "Strategist / Decoder",
        weights: { strategist: 2, decoder: 2 },
      },
      {
        id: "c",
        label: "Owning the concept, message, or creative quality",
        helper: "Creator",
        weights: { creator: 3, catalyst: 1 },
      },
      {
        id: "d",
        label: "Owning the trust, wellbeing, or support side of the work",
        helper: "Guide",
        weights: { guide: 3, strategist: 1 },
      },
    ],
  },
  {
    id: "deep-9",
    mode: "deep",
    prompt: "Which kind of problem could you imagine working on for a whole year?",
    helper: "Choose the one that still sounds interesting after the novelty wears off.",
    options: [
      {
        id: "a",
        label: "A physical system that needs fixing or improving",
        helper: "Builder",
        weights: { builder: 3, decoder: 1 },
      },
      {
        id: "b",
        label: "A hidden pattern or risk inside messy information",
        helper: "Decoder",
        weights: { decoder: 3, strategist: 1 },
      },
      {
        id: "c",
        label: "A messy experience people struggle to use or enjoy",
        helper: "Creator",
        weights: { creator: 3, guide: 1 },
      },
      {
        id: "d",
        label: "A real situation where people need confidence, care, or support",
        helper: "Guide",
        weights: { guide: 3, builder: 1 },
      },
    ],
  },
  {
    id: "deep-10",
    mode: "deep",
    prompt: "How do you usually influence a group when something important is happening?",
    helper: "Think about what people naturally look to you for.",
    options: [
      {
        id: "a",
        label: "I lead by doing and getting momentum started",
        helper: "Catalyst / Builder",
        weights: { catalyst: 2, builder: 2 },
      },
      {
        id: "b",
        label: "I frame the logic so people can make better decisions",
        helper: "Decoder / Strategist",
        weights: { decoder: 2, strategist: 2 },
      },
      {
        id: "c",
        label: "I make the idea feel exciting, compelling, and memorable",
        helper: "Creator / Catalyst",
        weights: { creator: 2, catalyst: 2 },
      },
      {
        id: "d",
        label: "I steady the room and make sure people feel heard",
        helper: "Guide / Strategist",
        weights: { guide: 2, strategist: 2 },
      },
    ],
  },
  {
    id: "deep-11",
    mode: "deep",
    prompt: "When the deadline is suddenly very real, what strength do you trust most?",
    helper: "Pick the move you actually make when time pressure hits.",
    options: [
      {
        id: "a",
        label: "I can execute quickly and keep things moving",
        helper: "Builder / Catalyst",
        weights: { builder: 2, catalyst: 2 },
      },
      {
        id: "b",
        label: "I can simplify the problem and focus on what matters",
        helper: "Strategist / Decoder",
        weights: { strategist: 2, decoder: 2 },
      },
      {
        id: "c",
        label: "I can find a sharper, stronger, or more engaging angle",
        helper: "Creator",
        weights: { creator: 3, catalyst: 1 },
      },
      {
        id: "d",
        label: "I can keep people calm, coordinated, and on track",
        helper: "Guide",
        weights: { guide: 3, strategist: 1 },
      },
    ],
  },
  {
    id: "deep-12",
    mode: "deep",
    prompt: "If you could leave school already genuinely strong at one thing, what would you pick?",
    helper: "Choose the skillset that feels most valuable to the future version of you.",
    options: [
      {
        id: "a",
        label: "Building, fixing, and making useful systems work",
        helper: "Builder",
        weights: { builder: 3, strategist: 1 },
      },
      {
        id: "b",
        label: "Analysing complex problems with confidence",
        helper: "Decoder",
        weights: { decoder: 3, catalyst: 1 },
      },
      {
        id: "c",
        label: "Designing strong ideas people actually connect with",
        helper: "Creator",
        weights: { creator: 3, guide: 1 },
      },
      {
        id: "d",
        label: "Helping people feel supported, capable, and clear",
        helper: "Guide",
        weights: { guide: 3, catalyst: 1 },
      },
    ],
  },
] as const;

const QUIZ_ARCHETYPES: Partial<Record<`${QuizDimensionId}:${QuizDimensionId}`, { title: string; summary: string }>> = {
  "builder:guide": {
    title: "Community Responder",
    summary: "You look drawn to practical work that also helps people feel safer, steadier, or more supported.",
  },
  "builder:strategist": {
    title: "Systems Builder",
    summary: "You seem to like work where clear plans turn into real, useful outcomes that people can depend on.",
  },
  "decoder:creator": {
    title: "Insight Designer",
    summary: "You seem strongest where analysis and imagination work together to shape smarter solutions.",
  },
  "decoder:strategist": {
    title: "Signal Planner",
    summary: "You likely enjoy reading complex patterns, then turning them into reliable decisions and direction.",
  },
  "creator:guide": {
    title: "Human Experience Designer",
    summary: "You seem interested in work that feels imaginative but still grounded in real human needs.",
  },
  "creator:catalyst": {
    title: "Launch Lead",
    summary: "You likely enjoy turning ideas into something visible, energetic, and worth rallying around.",
  },
  "guide:strategist": {
    title: "Care Coordinator",
    summary: "You appear to value steady, organised support where people trust you to keep things clear and moving.",
  },
  "catalyst:decoder": {
    title: "Digital Defender",
    summary: "You seem well matched to fast-moving roles where judgement, pattern recognition, and action matter together.",
  },
  "catalyst:builder": {
    title: "Momentum Maker",
    summary: "You appear energised by action, delivery, and stepping forward when something needs movement.",
  },
  "strategist:guide": {
    title: "Support Architect",
    summary: "You seem to like creating stable systems that help people move through complicated situations well.",
  },
};

export function getQuestionsForMode(mode: QuizModeId) {
  return QUIZ_QUESTIONS.filter((question) => question.mode === mode);
}

export function buildQuizResult(mode: QuizModeId, answers: QuizAnswerMap): QuizResult {
  const questions = getQuestionsForMode(mode);
  const scoreMap: Record<QuizDimensionId, number> = {
    builder: 0,
    decoder: 0,
    creator: 0,
    guide: 0,
    catalyst: 0,
    strategist: 0,
  };

  for (const question of questions) {
    const selectedIds = answers[question.id] ?? [];
    for (const answerId of selectedIds) {
      const option = question.options.find((entry) => entry.id === answerId);

      if (!option) {
        continue;
      }

      for (const [dimension, weight] of Object.entries(option.weights) as Array<[
        QuizDimensionId,
        number,
      ]>) {
        scoreMap[dimension] += weight;
      }
    }
  }

  const sorted = (Object.keys(scoreMap) as QuizDimensionId[])
    .map((dimension) => ({
      definition: QUIZ_DIMENSIONS[dimension],
      score: scoreMap[dimension],
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.definition.label.localeCompare(right.definition.label);
    });

  const topStyle = sorted[0].definition;
  const supportStyle = (sorted[1] ?? sorted[0]).definition;
  const supportStyle2 = mode === "deep" ? (sorted[2] ?? sorted[1]).definition : undefined;
  const maxScore = Math.max(sorted[0]?.score ?? 1, 1);
  const archetype =
    QUIZ_ARCHETYPES[`${topStyle.id}:${supportStyle.id}`] ??
    QUIZ_ARCHETYPES[`${supportStyle.id}:${topStyle.id}`] ?? {
      title: `${topStyle.label} + ${supportStyle.label}`,
      summary: `Your answers suggest a mix of ${topStyle.label.toLowerCase()} energy and ${supportStyle.label.toLowerCase()} support.`,
    };
  const careerCount = mode === "deep" ? 4 : 3;
  const recommendedCareers = getRecommendedCareers(topStyle, supportStyle, careerCount, supportStyle2);
  const exploreSearch = recommendedCareers[0]?.title ?? topStyle.exploreSearch;

  return {
    mode,
    totalQuestions: questions.length,
    archetypeTitle: archetype.title,
    archetypeSummary: archetype.summary,
    topStyle,
    supportStyle,
    supportStyle2,
    recommendedCareers,
    exploreInterest: topStyle.exploreInterest ?? supportStyle.exploreInterest,
    exploreSearch,
    scoreBreakdown: sorted.map(({ definition, score }) => ({
      dimension: definition.id,
      label: definition.label,
      score,
      percent: Math.max(12, Math.round((score / maxScore) * 100)),
    })),
  };
}
