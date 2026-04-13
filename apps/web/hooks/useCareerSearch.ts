"use client";

import { useDeferredValue } from "react";
import { CAREER_CARDS, CAREER_PROFILES, type CareerCard } from "@/lib/career-data";

function getCareerSearchScore(career: CareerCard, query: string) {
  if (!query) {
    return 0;
  }

  const profile = CAREER_PROFILES[career.id];
  const title = career.title.toLowerCase();
  const meta = career.meta.toLowerCase();
  const tag = career.tag.toLowerCase();
  const teaser = career.teaser.toLowerCase();
  const badge = profile.badge.toLowerCase();
  const source = profile.source.toLowerCase();
  const keywords = profile.keywords.map((keyword) => keyword.toLowerCase());
  const interests = profile.interestBuckets.map((bucket) => bucket.toLowerCase());

  let score = 0;

  if (title.startsWith(query)) {
    score += 120;
  } else if (title.includes(query)) {
    score += 90;
  }

  if (keywords.some((keyword) => keyword.startsWith(query))) {
    score += 80;
  } else if (keywords.some((keyword) => keyword.includes(query))) {
    score += 55;
  }

  if (interests.some((bucket) => bucket.includes(query))) {
    score += 48;
  }

  if (meta.includes(query)) {
    score += 36;
  }

  if (tag.includes(query)) {
    score += 28;
  }

  if (badge.includes(query)) {
    score += 22;
  }

  if (teaser.includes(query) || source.includes(query)) {
    score += 16;
  }

  return score;
}

export function useCareerSearch(query: string, activeInterest: string | null): CareerCard[] {
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filtered = CAREER_CARDS.filter((career) => {
    const profile = CAREER_PROFILES[career.id];
    const matchesInterest = !activeInterest || profile.interestBuckets.includes(activeInterest);

    if (!matchesInterest) {
      return false;
    }

    if (deferredQuery.length === 0) {
      return true;
    }

    return getCareerSearchScore(career, deferredQuery) > 0;
  });

  if (deferredQuery.length === 0) {
    return filtered;
  }

  return [...filtered].sort((left, right) => {
    const scoreDelta =
      getCareerSearchScore(right, deferredQuery) - getCareerSearchScore(left, deferredQuery);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.title.localeCompare(right.title);
  });
}
