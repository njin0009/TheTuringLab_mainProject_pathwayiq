import type { CareerId } from "@/lib/career-data";
import type { INTEREST_TAGS } from "@/lib/career-data";

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
  recommendedCareerIds: CareerId[];
  workLikes: string[];
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
  scoreBreakdown: QuizScoreBreakdown[];
  recommendedCareerIds: CareerId[];
  exploreInterest: (typeof INTEREST_TAGS)[number] | null;
  exploreSearch: string;
}

export type QuizAnswerMap = Record<string, string>;

export const QUIZ_MODES: QuizModeDefinition[] = [
  {
    id: "quick",
    title: "Quick Match",
    duration: "6 questions · about 1 minute",
    questionCount: 6,
    blurb: "A fast direction check when you want a rough sense of where to look first.",
    helper: "Best when you want a short, low-pressure starting point.",
  },
  {
    id: "deep",
    title: "Deep Match",
    duration: "12 questions · about 3 minutes",
    questionCount: 12,
    blurb: "A more complete read across multiple work-style dimensions before you explore careers.",
    helper: "Best when you want stronger signals before you browse pathways.",
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
    recommendedCareerIds: ["career-elec", "career-wind", "career-solar"],
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
    recommendedCareerIds: ["career-ds", "career-cyber", "career-prompt"],
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
    recommendedCareerIds: ["career-ux", "career-prompt", "career-solar"],
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
    recommendedCareerIds: ["career-nurse", "career-physio", "career-ux"],
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
    recommendedCareerIds: ["career-cyber", "career-freight", "career-solar"],
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
    recommendedCareerIds: ["career-ds", "career-freight", "career-cyber"],
    workLikes: ["planning ahead", "systems and structure", "steady execution"],
  },
};

const makeOptions = (
  builder: string,
  decoder: string,
  creator: string,
  guide: string,
): QuizQuestionOption[] => [
  {
    id: "a",
    label: builder,
    helper: "Hands-on, practical, action-first",
    weights: { builder: 3, catalyst: 1 },
  },
  {
    id: "b",
    label: decoder,
    helper: "Analytical, logical, insight-driven",
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
    prompt: "A new school project drops today. Which role sounds best first?",
    helper: "Pick the one you would naturally reach for before anyone tells you what to do.",
    options: makeOptions(
      "Build the prototype or test something practical",
      "Work out the pattern, data, or logic behind it",
      "Shape the concept, look, or pitch",
      "Keep everyone aligned and supported",
    ),
  },
  {
    id: "quick-2",
    mode: "quick",
    prompt: "Which kind of win feels most satisfying to you?",
    helper: "Think about what makes you say, “Yes, that felt worth it.”",
    options: makeOptions(
      "Something physical or useful now works better",
      "I cracked a tough problem no one else could see clearly",
      "An idea came to life in a way people noticed",
      "Someone felt calmer, stronger, or more understood because I helped",
    ),
  },
  {
    id: "quick-3",
    mode: "quick",
    prompt: "If you had a free afternoon to explore something, what sounds best?",
    helper: "Go with interest, not what you think you should choose.",
    options: makeOptions(
      "Trying tools, building, fixing, or testing equipment",
      "Investigating a mystery, game strategy, or complex system",
      "Designing, writing, filming, sketching, or brainstorming",
      "Coaching, helping, or checking in with people",
    ),
  },
  {
    id: "quick-4",
    mode: "quick",
    prompt: "Which school task drains you the least?",
    helper: "This is about what you can stay with longest when no one is forcing you.",
    options: makeOptions(
      "Labs, construction, workshop, or practical setup",
      "Research, maths, logic, or spreadsheet-style tasks",
      "Presentations, campaigns, visual work, or concepting",
      "Tutoring, group support, or wellbeing-focused work",
    ),
  },
  {
    id: "quick-5",
    mode: "quick",
    prompt: "People usually come to you when they need...",
    helper: "Think about the role you already play in your class or friend group.",
    options: [
      {
        id: "a",
        label: "Someone who can get stuck in and make something happen",
        helper: "Action-oriented, practical, fast-moving",
        weights: { builder: 2, catalyst: 2 },
      },
      {
        id: "b",
        label: "Someone who can explain what is really happening",
        helper: "Analytical, calm, evidence-led",
        weights: { decoder: 2, strategist: 2 },
      },
      {
        id: "c",
        label: "A fresh angle or a more interesting approach",
        helper: "Imaginative, expressive, lateral",
        weights: { creator: 2, catalyst: 2 },
      },
      {
        id: "d",
        label: "Someone who listens well and keeps people steady",
        helper: "Supportive, clear, reassuring",
        weights: { guide: 2, strategist: 2 },
      },
    ],
  },
  {
    id: "quick-6",
    mode: "quick",
    prompt: "If a future job felt “right”, what would it probably include?",
    helper: "Choose the strongest signal for you, even if more than one sounds good.",
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
        label: "People, trust, and meaningful impact on someone’s day",
        helper: "Guide",
        weights: { guide: 3, catalyst: 1 },
      },
    ],
  },
  {
    id: "deep-1",
    mode: "deep",
    prompt: "In a team, where do you naturally become useful first?",
    helper: "Think about how you usually contribute before roles are assigned.",
    options: [
      {
        id: "a",
        label: "I get the task moving so nothing sits still for too long",
        helper: "Catalyst",
        weights: { catalyst: 3, builder: 1 },
      },
      {
        id: "b",
        label: "I work out the plan so the team stops guessing",
        helper: "Strategist",
        weights: { strategist: 3, decoder: 1 },
      },
      {
        id: "c",
        label: "I shape the direction so it feels smarter or more original",
        helper: "Creator",
        weights: { creator: 3, decoder: 1 },
      },
      {
        id: "d",
        label: "I notice what people need so the group runs better",
        helper: "Guide",
        weights: { guide: 3, catalyst: 1 },
      },
    ],
  },
  {
    id: "deep-2",
    mode: "deep",
    prompt: "What kind of challenge keeps you interested longer than most people?",
    helper: "Choose the one that pulls you in even when it is difficult.",
    options: makeOptions(
      "A practical task that needs patience and real execution",
      "A system, case, or puzzle that needs deep thinking",
      "An idea that could become more interesting or more human",
      "A situation where people need care, guidance, or clarity",
    ),
  },
  {
    id: "deep-3",
    mode: "deep",
    prompt: "If a teacher gave you total freedom for a final project, what would you build around?",
    helper: "Imagine no one is grading the style, only whether it feels genuinely yours.",
    options: [
      {
        id: "a",
        label: "A working solution, prototype, or hands-on demonstration",
        helper: "Builder",
        weights: { builder: 3, creator: 1 },
      },
      {
        id: "b",
        label: "A research-driven case with findings and a clear answer",
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
        label: "A practical guide or support resource for real people",
        helper: "Guide",
        weights: { guide: 3, strategist: 1 },
      },
    ],
  },
  {
    id: "deep-4",
    mode: "deep",
    prompt: "What do you notice first when something is going badly?",
    helper: "This helps show what your attention naturally locks onto.",
    options: [
      {
        id: "a",
        label: "The part that is physically broken or not working",
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
        label: "The experience feels confusing, dull, or badly designed",
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
    prompt: "Which compliment feels the most accurate when it is said about you?",
    helper: "Pick the one that makes you think, “Yes, that is me when I am at my best.”",
    options: [
      {
        id: "a",
        label: "You actually get things done",
        helper: "Builder / Catalyst",
        weights: { builder: 2, catalyst: 2 },
      },
      {
        id: "b",
        label: "You see things other people miss",
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
        label: "You make people feel safe and clear",
        helper: "Guide / Strategist",
        weights: { guide: 2, strategist: 2 },
      },
    ],
  },
  {
    id: "deep-6",
    mode: "deep",
    prompt: "Which kind of work environment sounds most natural to you?",
    helper: "Ignore status. Choose by fit.",
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
    prompt: "When you imagine your future, which feeling matters most?",
    helper: "This is about the energy you want from work, not a job title.",
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
    prompt: "What kind of responsibility sounds most exciting?",
    helper: "This helps separate initiative from interest.",
    options: [
      {
        id: "a",
        label: "Owning delivery and making sure something gets built",
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
        label: "Owning the wellbeing, trust, or support side of the work",
        helper: "Guide",
        weights: { guide: 3, strategist: 1 },
      },
    ],
  },
  {
    id: "deep-9",
    mode: "deep",
    prompt: "Which kind of problem would you rather solve for a year?",
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
        label: "A confusing experience people struggle to use",
        helper: "Creator",
        weights: { creator: 3, guide: 1 },
      },
      {
        id: "d",
        label: "A real situation where people need confidence or care",
        helper: "Guide",
        weights: { guide: 3, builder: 1 },
      },
    ],
  },
  {
    id: "deep-10",
    mode: "deep",
    prompt: "How do you usually influence a group?",
    helper: "Think about how people respond to you when something important is happening.",
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
        label: "I make the idea feel compelling and memorable",
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
    prompt: "When deadlines are close, what strength do you trust most?",
    helper: "Pick the move you make when time pressure is real.",
    options: [
      {
        id: "a",
        label: "I can execute fast and keep things moving",
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
        label: "I can find a sharper or more engaging angle",
        helper: "Creator",
        weights: { creator: 3, catalyst: 1 },
      },
      {
        id: "d",
        label: "I can keep people calm and coordinated",
        helper: "Guide",
        weights: { guide: 3, strategist: 1 },
      },
    ],
  },
  {
    id: "deep-12",
    mode: "deep",
    prompt: "If you could leave school already good at one thing, what would you pick?",
    helper: "Choose the capability that feels most valuable to your future self.",
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
    const answerId = answers[question.id];
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
  const maxScore = Math.max(sorted[0]?.score ?? 1, 1);
  const archetype =
    QUIZ_ARCHETYPES[`${topStyle.id}:${supportStyle.id}`] ??
    QUIZ_ARCHETYPES[`${supportStyle.id}:${topStyle.id}`] ?? {
      title: `${topStyle.label} + ${supportStyle.label}`,
      summary: `Your answers suggest a mix of ${topStyle.label.toLowerCase()} energy and ${supportStyle.label.toLowerCase()} support.`,
    };

  const recommendedCareerIds = Array.from(
    new Set([...topStyle.recommendedCareerIds, ...supportStyle.recommendedCareerIds]),
  ).slice(0, 3);

  return {
    mode,
    totalQuestions: questions.length,
    archetypeTitle: archetype.title,
    archetypeSummary: archetype.summary,
    topStyle,
    supportStyle,
    recommendedCareerIds,
    exploreInterest: topStyle.exploreInterest ?? supportStyle.exploreInterest,
    exploreSearch: topStyle.exploreSearch,
    scoreBreakdown: sorted.map(({ definition, score }) => ({
      dimension: definition.id,
      label: definition.label,
      score,
      percent: Math.max(12, Math.round((score / maxScore) * 100)),
    })),
  };
}
