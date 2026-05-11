import type { CareerId } from "@/lib/career-data";
import type { QuizDimensionId } from "@/lib/quiz-data";

export const REPORT_STYLE_BY_CAREER_ID: Record<CareerId, QuizDimensionId> = {
  "career-ds": "decoder",
  "career-nurse": "guide",
  "career-elec": "builder",
  "career-cyber": "decoder",
  "career-solar": "builder",
  "career-wind": "builder",
  "career-physio": "guide",
  "career-ux": "creator",
  "career-prompt": "creator",
  "career-freight": "strategist",
  "career-data-entry": "strategist",
};
