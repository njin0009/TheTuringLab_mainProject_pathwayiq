export type CareerId =
  | "career-ds"
  | "career-nurse"
  | "career-elec"
  | "career-cyber"
  | "career-solar"
  | "career-wind"
  | "career-physio"
  | "career-ux"
  | "career-prompt"
  | "career-freight"
  | "career-data-entry";

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
  source: string;
  riskLabel: string;
  riskPercent: number;
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

export interface ExploreAutocompleteItem {
  value: string;
  detail: string;
  category: "career" | "interest" | "skill";
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
    salary: "$95k - $145k",
    summary: "Great for students who enjoy structured problem-solving, pattern finding, and turning messy data into clear decisions.",
    source: "Source: JSA 2025 OSL",
    riskLabel: "Low (18%)",
    riskPercent: 18,
    keywords: ["data", "science", "analytics", "ai", "python", "machine learning", "sql"],
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
    salary: "$78k - $115k",
    summary: "A strong fit for human-centred students who care about communication, teamwork, and direct community impact.",
    source: "Source: NCVER 2024",
    riskLabel: "Minimal (4%)",
    riskPercent: 4,
    keywords: ["nurse", "healthcare", "hospital", "care", "clinical", "patient support"],
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
    source: "Source: Infrastructure Skills Forecast",
    riskLabel: "Very Low (6%)",
    riskPercent: 6,
    keywords: ["electrician", "trade", "wiring", "apprenticeship", "construction", "maintenance"],
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
    salary: "$110k - $180k",
    summary: "Well suited to students who like digital systems, investigation, and defending organisations from real-world threats.",
    source: "Source: OECD Future Jobs",
    riskLabel: "Very Low (5%)",
    riskPercent: 5,
    keywords: ["cyber", "security", "analyst", "networks", "ethical hacking", "soc"],
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
  "career-solar": {
    id: "career-solar",
    icon: "☀️",
    badge: "Renewable Energy · Shortage",
    title: "Solar Systems Engineer",
    salary: "$95k - $145k",
    summary: "A clean-energy pathway for students who want engineering depth, site impact, and future-facing infrastructure work.",
    source: "Source: JSA 2025 OSL",
    riskLabel: "Low (12%)",
    riskPercent: 12,
    keywords: ["solar", "renewable", "grid", "energy", "sustainability", "systems engineer"],
    interestBuckets: ["Hands-on Trades", "Creative Problem Solving"],
    stats: [
      { lbl: "Pathway", val: "VET / Degree" },
      { lbl: "AI risk", val: "Low - field and systems blend" },
      { lbl: "10yr growth", val: "+27% - green energy buildout" },
      { lbl: "VIC demand", val: "High - 540 openings/yr" },
      { lbl: "Key skills", val: "Energy systems, CAD, project delivery" },
      { lbl: "ATAR needed", val: "~70+ or diploma pathway" },
    ],
  },
  "career-wind": {
    id: "career-wind",
    icon: "🌬️",
    badge: "Renewable Energy · Shortage",
    title: "Wind Turbine Technician",
    salary: "$82k - $128k",
    summary: "Best for students who want outdoor technical work, diagnostics, and a direct role in the energy transition.",
    source: "Source: Green Skills Update 2025",
    riskLabel: "Very Low (9%)",
    riskPercent: 9,
    keywords: ["wind", "turbine", "renewable", "maintenance", "field tech"],
    interestBuckets: ["Hands-on Trades"],
    stats: [
      { lbl: "Pathway", val: "Diploma / Apprenticeship" },
      { lbl: "AI risk", val: "Very Low - physical maintenance role" },
      { lbl: "10yr growth", val: "+24% - major project pipeline" },
      { lbl: "VIC demand", val: "Growing - 260 openings/yr" },
      { lbl: "Key skills", val: "Diagnostics, climbing safety, mechanical systems" },
      { lbl: "ATAR needed", val: "No ATAR required" },
    ],
  },
  "career-physio": {
    id: "career-physio",
    icon: "🧠",
    badge: "Healthcare · Growth",
    title: "Physiotherapist",
    salary: "$80k - $125k",
    summary: "A strong option for students who enjoy movement science, coaching, and helping people recover over time.",
    source: "Source: Allied Health Workforce Report",
    riskLabel: "Very Low (7%)",
    riskPercent: 7,
    keywords: ["physio", "rehab", "movement", "sports", "healthcare"],
    interestBuckets: ["Healthcare", "Creative Problem Solving"],
    stats: [
      { lbl: "Pathway", val: "Bachelor / Masters" },
      { lbl: "AI risk", val: "Very Low - coaching and physical assessment" },
      { lbl: "10yr growth", val: "+17% - ageing and sports demand" },
      { lbl: "VIC demand", val: "High - 410 openings/yr" },
      { lbl: "Key skills", val: "Assessment, communication, rehab planning" },
      { lbl: "ATAR needed", val: "~85+ recommended" },
    ],
  },
  "career-ux": {
    id: "career-ux",
    icon: "🎨",
    badge: "Design · Growth",
    title: "UX Designer",
    salary: "$85k - $130k",
    summary: "Fits students who love creative systems thinking, product design, research, and simplifying complex user journeys.",
    source: "Source: Digital Skills Snapshot 2025",
    riskLabel: "Moderate (28%)",
    riskPercent: 28,
    keywords: ["ux", "design", "product", "research", "prototype", "interface"],
    interestBuckets: ["Creative Problem Solving", "Data & AI"],
    stats: [
      { lbl: "Pathway", val: "Degree / Bootcamp / Portfolio" },
      { lbl: "AI risk", val: "Moderate - AI assists, humans shape systems" },
      { lbl: "10yr growth", val: "+14% - strong digital demand" },
      { lbl: "VIC demand", val: "Steady - 340 openings/yr" },
      { lbl: "Key skills", val: "Research, prototyping, systems thinking" },
      { lbl: "ATAR needed", val: "Flexible - portfolio matters" },
    ],
  },
  "career-prompt": {
    id: "career-prompt",
    icon: "🤖",
    badge: "Technology · Emerging",
    title: "AI Prompt Engineer",
    salary: "$120k - $210k",
    summary: "An emerging role for students who want to design AI workflows, evaluate outputs, and translate human goals into system prompts.",
    source: "Source: Industry Aggregated 2025",
    riskLabel: "Low (22%)",
    riskPercent: 22,
    keywords: ["prompt", "llm", "ai workflows", "generative ai", "evaluation"],
    interestBuckets: ["Data & AI", "Creative Problem Solving"],
    stats: [
      { lbl: "Pathway", val: "Bootcamp / Degree / Experience" },
      { lbl: "AI risk", val: "Low - job evolves with tooling" },
      { lbl: "10yr growth", val: "+35% - new workflow category" },
      { lbl: "VIC demand", val: "Emerging - fast-moving hiring" },
      { lbl: "Key skills", val: "Prompting, testing, systems writing" },
      { lbl: "ATAR needed", val: "Flexible - portfolio driven" },
    ],
  },
  "career-freight": {
    id: "career-freight",
    icon: "🚚",
    badge: "Logistics · Transition",
    title: "Freight Forwarder",
    salary: "$65k - $88k",
    summary: "A coordination-heavy role for students who like operations, timing, and keeping physical supply chains moving.",
    source: "Source: OECD Future Jobs",
    riskLabel: "High (64%)",
    riskPercent: 64,
    keywords: ["freight", "logistics", "supply chain", "shipping", "operations"],
    interestBuckets: ["Creative Problem Solving", "Hands-on Trades"],
    stats: [
      { lbl: "Pathway", val: "Diploma / Entry + Upskilling" },
      { lbl: "AI risk", val: "High - workflow automation pressure" },
      { lbl: "10yr growth", val: "+6% - stable logistics demand" },
      { lbl: "VIC demand", val: "Moderate - 320 openings/yr" },
      { lbl: "Key skills", val: "Coordination, customs, scheduling" },
      { lbl: "ATAR needed", val: "No ATAR required" },
    ],
  },
  "career-data-entry": {
    id: "career-data-entry",
    icon: "⌨️",
    badge: "Financial Services · Disappear",
    title: "Data Entry Specialist",
    salary: "$55k - $72k",
    summary: "Included as a contrast role so students can see how automation risk changes the pathway conversation.",
    source: "Source: ABS 2024",
    riskLabel: "High (88%)",
    riskPercent: 88,
    keywords: ["data entry", "admin", "clerical", "operations support", "records"],
    interestBuckets: ["Data & AI"],
    stats: [
      { lbl: "Pathway", val: "Direct Entry / Pivot Guide" },
      { lbl: "AI risk", val: "High - repetitive workflow automation" },
      { lbl: "10yr growth", val: "-8% - shrinking category" },
      { lbl: "VIC demand", val: "Declining - transition advised" },
      { lbl: "Key skills", val: "Records accuracy, admin workflows" },
      { lbl: "ATAR needed", val: "No ATAR required" },
    ],
  },
};

export const CAREER_CARDS: CareerCard[] = [
  {
    id: "career-solar",
    title: CAREER_PROFILES["career-solar"].title,
    icon: CAREER_PROFILES["career-solar"].icon,
    meta: "High demand · Renewable energy systems",
    tag: "Shortage",
    teaser: CAREER_PROFILES["career-solar"].summary,
  },
  {
    id: "career-ds",
    title: CAREER_PROFILES["career-ds"].title,
    icon: CAREER_PROFILES["career-ds"].icon,
    meta: "High demand · Data, AI, analytics",
    tag: "Analytical",
    teaser: CAREER_PROFILES["career-ds"].summary,
  },
  {
    id: "career-cyber",
    title: CAREER_PROFILES["career-cyber"].title,
    icon: CAREER_PROFILES["career-cyber"].icon,
    meta: "Fast growth · Digital defence",
    tag: "Security",
    teaser: CAREER_PROFILES["career-cyber"].summary,
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
    id: "career-wind",
    title: CAREER_PROFILES["career-wind"].title,
    icon: CAREER_PROFILES["career-wind"].icon,
    meta: "Regional demand · Field maintenance",
    tag: "Renewable",
    teaser: CAREER_PROFILES["career-wind"].summary,
  },
  {
    id: "career-prompt",
    title: CAREER_PROFILES["career-prompt"].title,
    icon: CAREER_PROFILES["career-prompt"].icon,
    meta: "Emerging role · AI workflows",
    tag: "Future-facing",
    teaser: CAREER_PROFILES["career-prompt"].summary,
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
    id: "career-physio",
    title: CAREER_PROFILES["career-physio"].title,
    icon: CAREER_PROFILES["career-physio"].icon,
    meta: "Healthcare growth · Recovery science",
    tag: "Care",
    teaser: CAREER_PROFILES["career-physio"].summary,
  },
  {
    id: "career-ux",
    title: CAREER_PROFILES["career-ux"].title,
    icon: CAREER_PROFILES["career-ux"].icon,
    meta: "Digital design · Research and product",
    tag: "Creative",
    teaser: CAREER_PROFILES["career-ux"].summary,
  },
  {
    id: "career-freight",
    title: CAREER_PROFILES["career-freight"].title,
    icon: CAREER_PROFILES["career-freight"].icon,
    meta: "Operations pathway · Supply chain",
    tag: "Logistics",
    teaser: CAREER_PROFILES["career-freight"].summary,
  },
  {
    id: "career-data-entry",
    title: CAREER_PROFILES["career-data-entry"].title,
    icon: CAREER_PROFILES["career-data-entry"].icon,
    meta: "Automation exposed · Contrast role",
    tag: "Transition",
    teaser: CAREER_PROFILES["career-data-entry"].summary,
  },
];

export const DEFAULT_COMPARE: CareerId[] = ["career-ds", "career-cyber"];

const autocompleteMap = new Map<string, ExploreAutocompleteItem>();

for (const career of CAREER_CARDS) {
  const profile = CAREER_PROFILES[career.id];
  autocompleteMap.set(career.title, {
    value: career.title,
    detail: `Career · ${profile.badge}`,
    category: "career",
  });
}

for (const tag of INTEREST_TAGS) {
  autocompleteMap.set(tag, {
    value: tag,
    detail: "Interest filter",
    category: "interest",
  });
}

for (const profile of Object.values(CAREER_PROFILES)) {
  for (const keyword of profile.keywords) {
    const key = keyword.trim();
    if (!key) {
      continue;
    }

    if (!autocompleteMap.has(key)) {
      autocompleteMap.set(key, {
        value: key,
        detail: `Skill keyword · ${profile.title}`,
        category: "skill",
      });
    }
  }
}

export const EXPLORE_AUTOCOMPLETE = Array.from(autocompleteMap.values());
