"use client";

import { useDeferredValue } from "react";
import { CAREER_CARDS, CAREER_PROFILES, type CareerCard } from "@/lib/career-data";

export function useCareerSearch(query: string, activeInterest: string | null): CareerCard[] {
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  return CAREER_CARDS.filter((career) => {
    const profile = CAREER_PROFILES[career.id];
    const matchesQuery =
      deferredQuery.length === 0 ||
      [career.title, career.meta, career.tag, career.teaser, profile.badge, ...profile.keywords]
        .join(" ")
        .toLowerCase()
        .includes(deferredQuery);

    const matchesInterest =
      !activeInterest || profile.interestBuckets.includes(activeInterest);

    return matchesQuery && matchesInterest;
  });
}
