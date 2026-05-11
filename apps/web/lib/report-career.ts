import type { CareerId } from "@/lib/career-data";
import type { QuizDimensionId } from "@/lib/quiz-data";

export interface ReportCareerSnapshot {
  sourceCareerId?: CareerId;
  title: string;
  industry: string;
  anzscoCode: string;
  medianSalary: number;
  pathway: string;
  shortageStatus: string;
  styleId: QuizDimensionId;
}
