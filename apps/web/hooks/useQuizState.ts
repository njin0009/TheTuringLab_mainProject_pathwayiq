"use client";

import { useState } from "react";
import { QUIZ_OPTIONS } from "@/lib/career-data";

export function useQuizState() {
  const [selectedOption, setSelectedOption] = useState<string>(QUIZ_OPTIONS[0]);

  return {
    selectedOption,
    selectOption: setSelectedOption,
  };
}
