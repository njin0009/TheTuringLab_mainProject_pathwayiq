export type CareerId = "career-ds" | "career-nurse" | "career-elec" | "career-cyber";

export interface CareerStat {
  lbl: string;
  val: string;
}

export interface CareerProfile {
  id: CareerId;
  icon: string;
  badge: string;
  title: string;
  salary: string;
  summary: string;
  stats: CareerStat[];
  keywords: string[];
  interestBuckets: string[];
}

export interface CareerCard {
  id: CareerId;
  title: string;
  icon: string;
  meta: string;
  tag: string;
  teaser: string;
}

export const SCENE_LABELS = ["Home", "Quiz", "Explore", "Compare", "Report"] as const;

export const INTEREST_TAGS = [
  "Data & AI",
  "Healthcare",
  "Hands-on Trades",
  "Cybersecurity",
  "Creative Problem Solving",
] as const;

export const QUIZ_OPTIONS = [
  "Solving complex puzzles with data",
  "Helping people through difficult times",
  "Building or fixing things with my hands",
  "Protecting people and systems from threats",
] as const;

export const QUIZ_TO_INTEREST: Record<(typeof QUIZ_OPTIONS)[number], (typeof INTEREST_TAGS)[number]> = {
  "Solving complex puzzles with data": "Data & AI",
  "Helping people through difficult times": "Healthcare",
  "Building or fixing things with my hands": "Hands-on Trades",
  "Protecting people and systems from threats": "Cybersecurity",
};

export const CAREER_PROFILES: Record<CareerId, CareerProfile> = {
  "career-ds": {
    id: "career-ds",
    icon: "📊",
    badge: "Technology · Shortage",
    title: "Data Scientist",
    salary: "$95k - $140k",
    summary: "Great for students who enjoy structured problem-solving, pattern finding, and turning messy data into clear decisions.",
    keywords: ["data", "science", "analytics", "ai", "python", "machine learning"],
    interestBuckets: ["Data & AI", "Creative Problem Solving"],
    stats: [
      { lbl: "Pathway", val: "Bachelor (3yr) or Masters" },
      { lbl: "AI risk", val: "Low - core analytical role" },
      { lbl: "10yr growth", val: "+22% - strong demand" },
      { lbl: "VIC demand", val: "High - 840 openings/yr" },
      { lbl: "Key skills", val: "Python, SQL, ML, statistics" },
      { lbl: "ATAR needed", val: "~80+ recommended" },
    ],
  },
  "career-nurse": {
    id: "career-nurse",
    icon: "⚕️",
    badge: "Healthcare · Shortage",
    title: "Registered Nurse",
    salary: "$75k - $110k",
    summary: "A strong fit for human-centred students who care about communication, teamwork, and direct community impact.",
    keywords: ["nurse", "healthcare", "hospital", "care", "clinical"],
    interestBuckets: ["Healthcare"],
    stats: [
      { lbl: "Pathway", val: "Bachelor of Nursing (3yr)" },
      { lbl: "AI risk", val: "Very Low - human-centred" },
      { lbl: "10yr growth", val: "+18% - national shortage" },
      { lbl: "VIC demand", val: "Very High - 2,400/yr" },
      { lbl: "Key skills", val: "Clinical care, empathy, teamwork" },
      { lbl: "ATAR needed", val: "~65+ recommended" },
    ],
  },
  "career-elec": {
    id: "career-elec",
    icon: "⚡",
    badge: "Trades · Shortage",
    title: "Electrician",
    salary: "$70k - $120k",
    summary: "Ideal for students who prefer active, hands-on work and enjoy practical systems, tools, and field work.",
    keywords: ["electrician", "trade", "wiring", "apprenticeship", "construction"],
    interestBuckets: ["Hands-on Trades", "Creative Problem Solving"],
    stats: [
      { lbl: "Pathway", val: "4yr Apprenticeship (TAFE)" },
      { lbl: "AI risk", val: "Very Low - hands-on trade" },
      { lbl: "10yr growth", val: "+15% - infrastructure boom" },
      { lbl: "VIC demand", val: "High - 1,100 openings/yr" },
      { lbl: "Key skills", val: "Wiring, safety, troubleshooting" },
      { lbl: "ATAR needed", val: "No ATAR required" },
    ],
  },
  "career-cyber": {
    id: "career-cyber",
    icon: "🛡️",
    badge: "Technology · Shortage",
    title: "Cybersecurity Analyst",
    salary: "$90k - $135k",
    summary: "Well suited to students who like digital systems, investigation, and defending organisations from real-world threats.",
    keywords: ["cyber", "security", "analyst", "networks", "ethical hacking"],
    interestBuckets: ["Cybersecurity", "Data & AI"],
    stats: [
      { lbl: "Pathway", val: "Bachelor IT/Cyber (3yr)" },
      { lbl: "AI risk", val: "Low - uses AI as a tool" },
      { lbl: "10yr growth", val: "+31% - fastest growing tech" },
      { lbl: "VIC demand", val: "High - 620 openings/yr" },
      { lbl: "Key skills", val: "Networks, risk, ethical hacking" },
      { lbl: "ATAR needed", val: "~75+ recommended" },
    ],
  },
};

export const CAREER_CARDS: CareerCard[] = [
  {
    id: "career-ds",
    title: CAREER_PROFILES["career-ds"].title,
    icon: CAREER_PROFILES["career-ds"].icon,
    meta: "High demand · Data, AI, analytics",
    tag: "Analytical",
    teaser: CAREER_PROFILES["career-ds"].summary,
  },
  {
    id: "career-nurse",
    title: CAREER_PROFILES["career-nurse"].title,
    icon: CAREER_PROFILES["career-nurse"].icon,
    meta: "Very high demand · Human-centred",
    tag: "People-first",
    teaser: CAREER_PROFILES["career-nurse"].summary,
  },
  {
    id: "career-elec",
    title: CAREER_PROFILES["career-elec"].title,
    icon: CAREER_PROFILES["career-elec"].icon,
    meta: "Strong demand · Trade pathway",
    tag: "Hands-on",
    teaser: CAREER_PROFILES["career-elec"].summary,
  },
  {
    id: "career-cyber",
    title: CAREER_PROFILES["career-cyber"].title,
    icon: CAREER_PROFILES["career-cyber"].icon,
    meta: "Fastest growth · Digital defence",
    tag: "Security",
    teaser: CAREER_PROFILES["career-cyber"].summary,
  },
];

export const DEFAULT_COMPARE: CareerId[] = ["career-ds", "career-cyber"];
