"use client";

export interface BackendCareerRecord {
  anzsco_code: string;
  title: string;
  industry: string;
  median_salary: string;
  pathway: string;
  shortage_status: string;
  ai_risk?: string; // "Low" | "Medium" | "High" — pre-computed by Lambda
}

export interface SearchCareersParams {
  q?: string;
  pathway?: "TAFE" | "Apprenticeship" | "University";
  shortage_status?: "In Shortage" | "Not in Shortage";
}

const DEFAULT_CAREERS_API_URL =
  "https://ml4dqmpnn9.execute-api.ap-southeast-2.amazonaws.com/careers";

function getCareersApiUrl() {
  return process.env.NEXT_PUBLIC_CAREERS_API_URL?.trim() || DEFAULT_CAREERS_API_URL;
}

function normalizeCareerRecord(value: unknown): BackendCareerRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const {
    anzsco_code,
    title,
    industry,
    median_salary,
    pathway,
    shortage_status,
  } = record;

  if (
    typeof anzsco_code !== "string" ||
    typeof title !== "string" ||
    typeof industry !== "string" ||
    (typeof median_salary !== "string" && typeof median_salary !== "number") ||
    typeof pathway !== "string" ||
    typeof shortage_status !== "string"
  ) {
    return null;
  }

  const ai_risk = typeof record.ai_risk === "string" ? record.ai_risk : undefined;

  return {
    anzsco_code,
    title,
    industry,
    median_salary: String(median_salary),
    pathway,
    shortage_status,
    ...(ai_risk ? { ai_risk } : {}),
  };
}

export async function searchCareers(
  params: SearchCareersParams = {},
  options?: { signal?: AbortSignal },
) {
  const url = new URL(getCareersApiUrl());

  for (const [key, rawValue] of Object.entries(params)) {
    if (!rawValue) {
      continue;
    }

    url.searchParams.set(key, rawValue);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: options?.signal,
  });

  if (!response.ok) {
    let message = "Unable to load career results right now.";

    try {
      const errorPayload = (await response.json()) as { error?: string };
      if (errorPayload?.error) {
        message = errorPayload.error;
      }
    } catch {
      // Ignore JSON parse failures and keep the fallback message.
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("The careers API returned an unexpected response.");
  }

  return payload
    .map(normalizeCareerRecord)
    .filter((record): record is BackendCareerRecord => record !== null);
}
