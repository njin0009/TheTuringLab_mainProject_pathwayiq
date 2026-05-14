"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { CareerOverlay } from "@/components/pathway/career-overlay";
import {
  PathwayWalker,
  type PathwayWalkerVariant,
} from "@/components/pathway/pathway-walker";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Balloons, type BalloonsHandle } from "@/components/ui/balloons";
import { useCareerSearch } from "@/hooks/useCareerSearch";
import { useQuizState } from "@/hooks/useQuizState";
import {
  CAREER_CARDS,
  SCENE_LABELS,
  type CareerId,
} from "@/lib/career-data";

const DATA2_TITLE_BY_CAREER_ID: Record<CareerId, string> = {
  "career-ds": "Software Engineer",
  "career-nurse": "Registered Nurse (Medical Practice)",
  "career-elec": "Electrician (General)",
  "career-cyber": "Security Consultant",
  "career-solar": "Electrical Engineering Technician",
  "career-wind": "Telecommunications Technician",
  "career-physio": "Therapy Aide",
  "career-ux": "Graphic Designer",
  "career-prompt": "Developer Programmer",
  "career-freight": "Transport Company Manager",
  "career-data-entry": "Data Entry Operator",
};

const CAREER_TITLE_TO_ID: Record<string, CareerId> = {
  "Software Engineer": "career-ds",
  "Registered Nurse (Medical Practice)": "career-nurse",
  "Electrician (General)": "career-elec",
  "Security Consultant": "career-cyber",
  "Electrical Engineering Technician": "career-solar",
  "Telecommunications Technician": "career-wind",
  "Therapy Aide": "career-physio",
  "Graphic Designer": "career-ux",
  "Developer Programmer": "career-prompt",
  "Transport Company Manager": "career-freight",
  "Data Entry Operator": "career-data-entry",
};
import { QUIZ_DIMENSIONS, type QuizResult } from "@/lib/quiz-data";
import { REPORT_STYLE_BY_CAREER_ID } from "@/lib/report-style";
import type { ReportCareerSnapshot } from "@/lib/report-career";
import CompareScene from "@/scenes/compare";
import ExploreScene from "@/scenes/explore";
import HomeScene from "@/scenes/home";
import QuizScene from "@/scenes/quiz";
import ReportScene from "@/scenes/report";

const SCENE_GLOWS = [
  { base: "#010204", accent: "6,182,212", secondary: "249,115,22" },
  { base: "#081224", accent: "76,111,255", secondary: "0,196,106" },
  { base: "#06172b", accent: "87,182,255", secondary: "0,196,106" },
  { base: "#091120", accent: "125,211,252", secondary: "76,111,255" },
  { base: "#081125", accent: "165,180,252", secondary: "87,182,255" },
] as const;

const WALKER_DIALOGUE = [
  [
    "Use A / D or the left and right arrow keys to switch menus.",
    "Click me anytime if you want more guidance.",
    "Press Start when you're ready to begin.",
    "If you still have questions later, click me again and I will replay these tips.",
  ],
  [
    "Choose Quick Match for a fast read, or Deep Match for a fuller result.",
    "Answer the questions, then use Explore to open careers that fit your result.",
    "You can still use A / D or the arrow keys to switch menus.",
    "If you want this guidance again, click me and I will walk you through it once more.",
  ],
  [
    "Use the search bar or the filter chips to narrow this list.",
    "Scroll down to browse more cards, then open one for details.",
    "If two careers stand out, send them to Compare.",
    "If you need these Explore tips again, click me and I will replay them.",
  ],
  [
    "Tap the cards here to build your comparison set.",
    "Keep your best two options, then continue to Report.",
    "Use A / D or the arrow keys if you want to jump to another page.",
    "If you want to revisit these compare steps, click me again anytime.",
  ],
  [
    "This page sums up the direction you've built so far.",
    "Use Compare if you want to back up and inspect your choices again.",
    "Restart is here whenever you want a fresh run through the guide.",
    "If you want this report guidance again, click me and I will repeat it.",
  ],
] as const;

const WALKER_VARIANTS: PathwayWalkerVariant[] = [
  {
    src: "/undraw-scooter.svg",
    width: 800,
    height: 758,
    className: "h-[144px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.26)]",
  },
  {
    src: "/undraw-hiking.svg",
    width: 1045,
    height: 792,
    className: "h-[146px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.26)]",
  },
  {
    src: "/undraw-party.svg",
    width: 364,
    height: 581,
    className: "h-[142px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.26)]",
  },
  {
    src: "/undraw-with-love.svg",
    width: 681,
    height: 800,
    className: "h-[148px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.26)]",
  },
  {
    src: "/undraw-learning.svg",
    width: 394,
    height: 800,
    className: "h-[150px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.28)]",
    mirroredByDefault: true,
  },
] as const;

const WALKER_START_X = 80;
const WALKER_GROUND_BOTTOM = "calc(7rem + 12px)";
const WALKER_MOTION_MS = 220;
const WALKER_BUBBLE_MS = 4300;
const WALKER_SEQUENCE_GAP_MS = 180;

const INTERACTIVE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

interface WalkerState {
  x: number;
  facingRight: boolean;
}

interface WalkerBubbleState {
  id: number;
  text: string;
  current: number;
  total: number;
}

function isInteractiveElement(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }

  return (
    INTERACTIVE_TAGS.has(element.tagName) ||
    element.isContentEditable ||
    element.closest("[data-prevent-walker='true']") !== null
  );
}

export function PathwayExperience() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const balloonsRef = useRef<BalloonsHandle | null>(null);
  const walkerStateRef = useRef<WalkerState>({
    x: WALKER_START_X,
    facingRight: true,
  });
  const activeIdxRef = useRef(0);
  const walkerBubbleCursorRef = useRef<number[]>(WALKER_DIALOGUE.map(() => 0));
  const walkerVisibleLineRef = useRef<number[]>(WALKER_DIALOGUE.map(() => 0));
  const walkerMotionTimerRef = useRef<number | null>(null);
  const walkerBubbleTimerRef = useRef<number | null>(null);
  const walkerIntroTimerRef = useRef<number | null>(null);
  const walkerSequenceTimerRef = useRef<number | null>(null);
  const walkerAutoSceneRef = useRef<number | null>(null);
  const walkerAutoLineRef = useRef(0);
  const walkerIntroShownScenesRef = useRef<Set<number>>(new Set());

  const [activeIdx, setActiveIdx] = useState(0);
  const showGate = false;
  const gateTransitionPhase = "idle";
  const [homeHeroVersion, setHomeHeroVersion] = useState(0);
  const [homePanelOpen, setHomePanelOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [walkerBubble, setWalkerBubble] = useState<WalkerBubbleState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exploreLaunchKey, setExploreLaunchKey] = useState(0);
  const [activeInterest, setActiveInterest] = useState<string | null>(null);
  const [selectedCareerId, setSelectedCareerId] = useState<CareerId | null>(null);
  const [reportFocusId, setReportFocusId] = useState<CareerId | null>(null);
  const [dynamicReportCareer, setDynamicReportCareer] = useState<ReportCareerSnapshot | null>(null);
  const [hasReportInput, setHasReportInput] = useState(false);
  const [compareSeedTitles, setCompareSeedTitles] = useState<[string | null, string | null]>([null, null]);
  const [compareSeedKey, setCompareSeedKey] = useState(0);
  const {
    mode: quizMode,
    modes: quizModes,
    phase: quizPhase,
    questions: quizQuestions,
    answers: quizAnswers,
    currentQuestion: quizCurrentQuestion,
    currentQuestionIndex: quizCurrentQuestionIndex,
    questionNumber: quizQuestionNumber,
    selectedOptionIds: quizSelectedOptionIds,
    progressPercent: quizProgressPercent,
    hasAnsweredCurrent: quizHasAnsweredCurrent,
    canGoBack: quizCanGoBack,
    result: quizResult,
    startMode: startQuizMode,
    switchMode: switchQuizMode,
    chooseOption: chooseQuizOption,
    nextQuestion: nextQuizQuestion,
    previousQuestion: previousQuizQuestion,
    restartMode: restartQuizMode,
    resetQuiz,
  } = useQuizState();
  const filteredCareers = useCareerSearch(searchQuery, activeInterest);

  const primaryCareer = filteredCareers[0] ?? CAREER_CARDS[0];
  const reportCareerId = reportFocusId ?? selectedCareerId ?? primaryCareer.id;
  const reportStyle = QUIZ_DIMENSIONS[dynamicReportCareer?.styleId ?? REPORT_STYLE_BY_CAREER_ID[reportCareerId]];
  const reportCareerTitle =
    dynamicReportCareer?.title ??
    CAREER_CARDS.find((career) => career.id === reportCareerId)?.title ??
    "this report";
  const glow = SCENE_GLOWS[activeIdx] ?? SCENE_GLOWS[0];
  const brandColor = activeIdx === 0 ? "#22d3ee" : "#fb923c";
  const walkerVariant = WALKER_VARIANTS[activeIdx] ?? WALKER_VARIANTS[0];
  const isGateTransitioning = gateTransitionPhase !== "idle";
  const lockSceneControls = showGate || isGateTransitioning;
  const chromeTransitionClass =
    isGateTransitioning
      ? "opacity-0 translate-y-2"
      : "opacity-100 translate-y-0";

  const getSceneWidth = useCallback(
    () => scrollRef.current?.clientWidth || window.innerWidth,
    [],
  );

  const getDockedWalkerPosition = useCallback(() => {
    const button = document.querySelector<HTMLElement>(
      `[data-nav-item='${activeIdxRef.current}']`,
    );
    if (!button) {
      return null;
    }

    const rect = button.getBoundingClientRect();
    return {
      left: rect.left + rect.width / 2,
      bottom: window.innerHeight - rect.top + 20,
    };
  }, []);

  const renderWalker = useCallback((isWalking = false) => {
    const walker = walkerRef.current;
    if (!walker) {
      return;
    }

    const state = walkerStateRef.current;
    const dockedPosition = getDockedWalkerPosition();

    if (dockedPosition) {
      walker.style.left = `${dockedPosition.left}px`;
      walker.style.bottom = `${dockedPosition.bottom}px`;
    } else {
      walker.style.left = `${state.x}px`;
      walker.style.bottom = WALKER_GROUND_BOTTOM;
    }

    walker.classList.toggle("walker-walking", isWalking);
    walker.classList.toggle("walker-idle", !isWalking);

    const flipTarget = walker.querySelector(".walker-flip");
    if (flipTarget instanceof HTMLElement) {
      const defaultScale = Number(flipTarget.dataset.defaultScale ?? "1");
      flipTarget.style.transform = `scaleX(${state.facingRight ? defaultScale : -defaultScale})`;
      flipTarget.style.transformOrigin = "center center";
    }
  }, [getDockedWalkerPosition]);

  const startWalkerMotion = useCallback((faceRight: boolean) => {
    walkerStateRef.current.facingRight = faceRight;
    renderWalker(true);

    if (walkerMotionTimerRef.current !== null) {
      window.clearTimeout(walkerMotionTimerRef.current);
    }

    walkerMotionTimerRef.current = window.setTimeout(() => {
      renderWalker(false);
    }, WALKER_MOTION_MS);
  }, [renderWalker]);

  const scrollToScene = useCallback((
    idx: number,
    options?: {
      nextWalkerX?: number;
      faceRight?: boolean;
    },
  ) => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    if (idx === 0 && activeIdxRef.current !== 0) {
      setHomeHeroVersion((current) => current + 1);
    }

    const sceneWidth = getSceneWidth();
    const targetScroll = idx * sceneWidth;
    const state = walkerStateRef.current;
    state.facingRight = options?.faceRight ?? idx >= activeIdxRef.current;
    state.x = options?.nextWalkerX ?? WALKER_START_X;

    container.scrollTo({ left: targetScroll, behavior: "auto" });
    activeIdxRef.current = idx;
    startTransition(() => setActiveIdx(idx));
    setShowHint(false);
    window.requestAnimationFrame(() => renderWalker(false));
  }, [getSceneWidth, renderWalker]);

  useEffect(() => {
    activeIdxRef.current = activeIdx;
    window.requestAnimationFrame(() => renderWalker(false));
  }, [activeIdx, renderWalker]);

  useEffect(() => {
    return () => {
      if (walkerMotionTimerRef.current !== null) {
        window.clearTimeout(walkerMotionTimerRef.current);
      }

      if (walkerBubbleTimerRef.current !== null) {
        window.clearTimeout(walkerBubbleTimerRef.current);
      }

      if (walkerIntroTimerRef.current !== null) {
        window.clearTimeout(walkerIntroTimerRef.current);
      }

      if (walkerSequenceTimerRef.current !== null) {
        window.clearTimeout(walkerSequenceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      balloonsRef.current?.launchAnimation();
    }, 520);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overscrollBehavior = previousBodyOverscroll;
    };
  }, []);


  const clearWalkerBubbleTimers = useCallback(() => {
    if (walkerBubbleTimerRef.current !== null) {
      window.clearTimeout(walkerBubbleTimerRef.current);
      walkerBubbleTimerRef.current = null;
    }

    if (walkerIntroTimerRef.current !== null) {
      window.clearTimeout(walkerIntroTimerRef.current);
      walkerIntroTimerRef.current = null;
    }

    if (walkerSequenceTimerRef.current !== null) {
      window.clearTimeout(walkerSequenceTimerRef.current);
      walkerSequenceTimerRef.current = null;
    }

    walkerAutoSceneRef.current = null;
    walkerAutoLineRef.current = 0;
  }, []);

  const showWalkerBubble = useCallback((
    text: string,
    current: number,
    total: number,
    duration = WALKER_BUBBLE_MS,
  ) => {
    if (walkerBubbleTimerRef.current !== null) {
      window.clearTimeout(walkerBubbleTimerRef.current);
      walkerBubbleTimerRef.current = null;
    }

    setWalkerBubble({ id: Date.now(), text, current, total });

    walkerBubbleTimerRef.current = window.setTimeout(() => {
      setWalkerBubble(null);
      walkerBubbleTimerRef.current = null;
    }, duration);
  }, []);

  const showSceneWalkerLine = useCallback((
    sceneIdx: number,
    lineIdx: number,
    duration = WALKER_BUBBLE_MS,
  ) => {
    const lines = WALKER_DIALOGUE[sceneIdx] ?? WALKER_DIALOGUE[0];
    const safeIndex = Math.min(Math.max(lineIdx, 0), lines.length - 1);

    walkerVisibleLineRef.current[sceneIdx] = safeIndex;
    showWalkerBubble(lines[safeIndex], safeIndex + 1, lines.length, duration);
    return { lines, safeIndex };
  }, [showWalkerBubble]);

  const playWalkerIntroSequence = useCallback((sceneIdx: number, lineIdx = 0) => {
    const { lines, safeIndex } = showSceneWalkerLine(sceneIdx, lineIdx);

    walkerAutoSceneRef.current = sceneIdx;
    walkerAutoLineRef.current = safeIndex;

    const nextIndex = safeIndex + 1;
    if (nextIndex >= lines.length) {
      walkerAutoSceneRef.current = null;
      walkerAutoLineRef.current = 0;
      walkerBubbleCursorRef.current[sceneIdx] = 0;
      return;
    }

    walkerSequenceTimerRef.current = window.setTimeout(() => {
      walkerSequenceTimerRef.current = null;

      if (showGate || isGateTransitioning || activeIdxRef.current !== sceneIdx) {
        walkerAutoSceneRef.current = null;
        walkerAutoLineRef.current = 0;
        return;
      }

      playWalkerIntroSequence(sceneIdx, nextIndex);
    }, WALKER_BUBBLE_MS + WALKER_SEQUENCE_GAP_MS);
  }, [isGateTransitioning, showGate, showSceneWalkerLine]);

  useEffect(() => {
    setWalkerBubble(null);
    clearWalkerBubbleTimers();

    if (showGate || isGateTransitioning) {
      return;
    }

    const sceneIdx = activeIdx;

    if (walkerIntroShownScenesRef.current.has(sceneIdx)) {
      return;
    }
    walkerIntroShownScenesRef.current.add(sceneIdx);

    walkerBubbleCursorRef.current[sceneIdx] = 0;
    walkerIntroTimerRef.current = window.setTimeout(() => {
      playWalkerIntroSequence(sceneIdx);
      walkerIntroTimerRef.current = null;
    }, 260);
  }, [activeIdx, clearWalkerBubbleTimers, playWalkerIntroSequence, isGateTransitioning, showGate]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({ left: activeIdxRef.current * getSceneWidth(), behavior: "auto" });
    window.requestAnimationFrame(() => renderWalker(false));

    const moveCodes = new Set(["ArrowLeft", "ArrowRight", "KeyA", "KeyD"]);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (lockSceneControls) {
        return;
      }

      if (isInteractiveElement(event.target)) {
        return;
      }

      if (event.key === "Escape" && selectedCareerId) {
        setSelectedCareerId(null);
        return;
      }

      if (selectedCareerId || !moveCodes.has(event.code) || event.repeat) {
        return;
      }

      if (event.code === "ArrowRight" || event.code === "KeyD") {
        const nextIdx =
          activeIdxRef.current === SCENE_LABELS.length - 1 ? 0 : activeIdxRef.current + 1;

        if (activeIdxRef.current === SCENE_LABELS.length - 1) {
          setReportFocusId(null);
          setHomePanelOpen(false);
        }

        event.preventDefault();
        startWalkerMotion(true);
        scrollToScene(nextIdx, { nextWalkerX: WALKER_START_X, faceRight: true });
        return;
      }

      if ((event.code === "ArrowLeft" || event.code === "KeyA") && activeIdxRef.current > 0) {
        event.preventDefault();
        startWalkerMotion(false);
        scrollToScene(activeIdxRef.current - 1, {
          nextWalkerX: WALKER_START_X,
          faceRight: false,
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    getSceneWidth,
    lockSceneControls,
    renderWalker,
    scrollToScene,
    selectedCareerId,
    startWalkerMotion,
  ]);

  useEffect(() => {
    const handleResize = () => {
      scrollToScene(activeIdxRef.current, { nextWalkerX: WALKER_START_X });
      window.requestAnimationFrame(() => renderWalker(false));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderWalker, scrollToScene]);

  function handleQuizExplore(result: QuizResult) {
    setActiveInterest(result.exploreInterest);
    setSearchQuery(result.exploreSearch);
    setExploreLaunchKey((current) => current + 1);
    scrollToScene(2);
  }

  function handleQuizOpenRecommendedCareer(careerTitle: string) {
    setActiveInterest(null);
    setSearchQuery(careerTitle);
    setExploreLaunchKey((current) => current + 1);
    scrollToScene(2);
  }

  function handleHomeExplore(query?: string) {
    setActiveInterest(null);
    setSearchQuery(query ?? "");
    setExploreLaunchKey((current) => current + 1);
    scrollToScene(2);
  }

  function clearFilters() {
    setSearchQuery("");
    setActiveInterest(null);
  }

  function goToCompareWithCareer(careerId: CareerId) {
    const title = DATA2_TITLE_BY_CAREER_ID[careerId] ?? null;
    setCompareSeedTitles([title, null]);
    setCompareSeedKey((k) => k + 1);
    scrollToScene(3);
  }

  function restartExperienceFromReport() {
    setReportFocusId(null);
    setSelectedCareerId(null);
    setDynamicReportCareer(null);
    setHasReportInput(false);
    setHomePanelOpen(false);
    setCompareSeedTitles([null, null]);
    setCompareSeedKey((k) => k + 1);
    clearFilters();
    resetQuiz();
    scrollToScene(0);
  }

  function openCareer(careerId: CareerId) {
    setSelectedCareerId(careerId);
  }

  function openReportFromExplore(career: ReportCareerSnapshot) {
    setDynamicReportCareer(career);
    setReportFocusId(career.sourceCareerId ?? null);
    setHasReportInput(true);
    setSelectedCareerId(null);
    scrollToScene(4);
  }

  function openReportFromCompare(careerTitle: string | null) {
    setDynamicReportCareer(null);
    const careerId = careerTitle
      ? ((CAREER_TITLE_TO_ID as Record<string, CareerId | undefined>)[careerTitle] ?? null)
      : null;
    setReportFocusId(careerId);
    setHasReportInput(Boolean(careerTitle));
    scrollToScene(4);
  }

  function handleWalkerTalk() {
    if (showGate || isGateTransitioning) {
      return;
    }

    const sceneIdx = activeIdxRef.current;
    const lines = WALKER_DIALOGUE[sceneIdx] ?? WALKER_DIALOGUE[0];

    if (walkerAutoSceneRef.current === sceneIdx) {
      if (walkerSequenceTimerRef.current !== null) {
        window.clearTimeout(walkerSequenceTimerRef.current);
        walkerSequenceTimerRef.current = null;
      }

      const nextAutoLine = Math.min(walkerAutoLineRef.current + 1, lines.length - 1);
      playWalkerIntroSequence(sceneIdx, nextAutoLine);
      return;
    }

    const nextCursor = walkerBubbleCursorRef.current[sceneIdx] ?? 0;
    const nextIndex = nextCursor % lines.length;

    walkerBubbleCursorRef.current[sceneIdx] = (nextCursor + 1) % lines.length;
    showSceneWalkerLine(sceneIdx, nextIndex);
  }

  function handleWalkerBubblePrev() {
    if (showGate || isGateTransitioning) {
      return;
    }

    const sceneIdx = activeIdxRef.current;
    const lines = WALKER_DIALOGUE[sceneIdx] ?? WALKER_DIALOGUE[0];
    const currentIndex = walkerVisibleLineRef.current[sceneIdx] ?? 0;
    const prevIndex = (currentIndex - 1 + lines.length) % lines.length;

    clearWalkerBubbleTimers();
    walkerBubbleCursorRef.current[sceneIdx] = (prevIndex + 1) % lines.length;
    showSceneWalkerLine(sceneIdx, prevIndex);
  }

  function handleWalkerBubbleNext() {
    if (showGate || isGateTransitioning) {
      return;
    }

    const sceneIdx = activeIdxRef.current;
    const lines = WALKER_DIALOGUE[sceneIdx] ?? WALKER_DIALOGUE[0];
    const currentIndex = walkerVisibleLineRef.current[sceneIdx] ?? 0;
    const nextIndex = (currentIndex + 1) % lines.length;

    clearWalkerBubbleTimers();
    walkerBubbleCursorRef.current[sceneIdx] = (nextIndex + 1) % lines.length;
    showSceneWalkerLine(sceneIdx, nextIndex);
  }

  function handleWalkerBubbleClose() {
    if (showGate || isGateTransitioning) {
      return;
    }

    const sceneIdx = activeIdxRef.current;
    walkerBubbleCursorRef.current[sceneIdx] = walkerVisibleLineRef.current[sceneIdx] ?? 0;
    clearWalkerBubbleTimers();
    setWalkerBubble(null);
  }

  function handleSceneBack() {
    if (lockSceneControls || activeIdxRef.current === 0) {
      return;
    }

    setHomePanelOpen(false);
    startWalkerMotion(false);
    scrollToScene(0, { nextWalkerX: WALKER_START_X, faceRight: false });
  }

  return (
    <main className="relative h-screen overflow-hidden text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 transition-all duration-700"
        style={{
          backgroundColor: glow.base,
          backgroundImage: `radial-gradient(circle at 20% 78%, rgba(${glow.accent}, 0.18) 0%, transparent 35%), radial-gradient(circle at 82% 18%, rgba(${glow.secondary}, 0.16) 0%, transparent 30%)`,
        }}
      />
      <Balloons
        ref={balloonsRef}
        type="default"
        className="pointer-events-none fixed inset-0 z-[210]"
      />

      {!showGate ? (
        <header
          className={`pointer-events-none fixed inset-x-0 top-0 z-[180] flex items-center justify-between px-6 py-5 transition-all duration-500 ease-out md:px-10 ${chromeTransitionClass}`}
        >
          <div className="pointer-events-auto flex items-center gap-3">
            {activeIdx > 0 ? (
              <button
                type="button"
                onClick={handleSceneBack}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/24 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-black/34 hover:text-white"
              >
                <span aria-hidden className="text-base leading-none">
                  ←
                </span>
                <span>Back to Home</span>
              </button>
            ) : null}
            <div className="text-2xl font-semibold tracking-tight" style={{ color: brandColor }}>
              Pathway<span className="text-white">IQ</span>
            </div>
          </div>
          <div className="hidden rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300 md:block">
            Bottom rider flow restored
          </div>
        </header>
      ) : null}

      <div
        ref={scrollRef}
        className="no-scrollbar relative flex h-screen translate-y-0 overflow-hidden opacity-100 transition-[opacity,transform] duration-[680ms] ease-out"
        style={{ touchAction: "pan-y" }}
      >
        <HomeScene
          heroVersion={homeHeroVersion}
          panelVisible={homePanelOpen}
          onStart={() => setHomePanelOpen(true)}
          onBack={() => setHomePanelOpen(false)}
          onTakeQuiz={() => {
            resetQuiz();
            scrollToScene(1);
          }}
          onExplore={handleHomeExplore}
          onCompare={() => scrollToScene(3)}
        />
        <QuizScene
          phase={quizPhase}
          mode={quizMode}
          modes={quizModes}
          questions={quizQuestions}
          answers={quizAnswers}
          currentQuestion={quizCurrentQuestion}
          currentQuestionIndex={quizCurrentQuestionIndex}
          questionNumber={quizQuestionNumber}
          selectedOptionIds={quizSelectedOptionIds}
          progressPercent={quizProgressPercent}
          hasAnsweredCurrent={quizHasAnsweredCurrent}
          canGoBack={quizCanGoBack}
          result={quizResult}
          onChooseMode={startQuizMode}
          onChooseOption={chooseQuizOption}
          onNext={nextQuizQuestion}
          onPrevious={previousQuizQuestion}
          onRestartMode={restartQuizMode}
          onSwitchMode={switchQuizMode}
          onResetQuiz={resetQuiz}
          onExplore={handleQuizExplore}
          onOpenRecommendedCareer={handleQuizOpenRecommendedCareer}
        />
        <ExploreScene
          careers={filteredCareers}
          searchQuery={searchQuery}
          searchLaunchKey={exploreLaunchKey}
          activeInterest={activeInterest}
          onSearchChange={setSearchQuery}
          onSelectInterest={setActiveInterest}
          onOpenCareer={openCareer}
          onOpenReport={openReportFromExplore}
          onCompare={() => scrollToScene(3)}
          onClearFilters={clearFilters}
        />
        <CompareScene
          seedTitles={compareSeedTitles}
          seedKey={compareSeedKey}
          onReport={openReportFromCompare}
        />
        <ReportScene
          careerId={reportCareerId}
          dynamicCareer={dynamicReportCareer}
          hasReportInput={hasReportInput}
          startPanelVisible={homePanelOpen}
          onStart={() => setHomePanelOpen(true)}
          onStartBack={() => setHomePanelOpen(false)}
          onTakeQuiz={() => {
            resetQuiz();
            scrollToScene(1);
          }}
          onExplore={handleHomeExplore}
          onOpenCareer={openCareer}
          onCompare={goToCompareWithCareer}
          onRestart={restartExperienceFromReport}
        />
      </div>

      {!showGate && activeIdx !== 4 ? (
        <div className={`transition-all duration-500 ease-out ${chromeTransitionClass}`}>
          <PathwayWalker
            ref={walkerRef}
            variant={walkerVariant}
            bubble={walkerBubble}
            onTalk={handleWalkerTalk}
            onBubblePrev={handleWalkerBubblePrev}
            onBubbleNext={handleWalkerBubbleNext}
            onBubbleClose={handleWalkerBubbleClose}
          />
        </div>
      ) : null}

      {!showGate && showHint ? (
        <div
          className={`pointer-events-none fixed bottom-32 right-6 z-[190] hidden rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300 transition-all duration-500 ease-out md:flex ${chromeTransitionClass}`}
        >
          A / D or {"< >"} to ride between scenes
        </div>
      ) : null}

      {!showGate ? (
        <div
          className={`pointer-events-none fixed right-6 top-20 z-[190] hidden rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400 transition-all duration-500 ease-out md:flex ${chromeTransitionClass}`}
        >
          {SCENE_LABELS[activeIdx]}
        </div>
      ) : null}

      {!showGate ? (
        <div className={`transition-all duration-500 ease-out ${chromeTransitionClass}`}>
          <BottomNav
            activeIdx={activeIdx}
            onNavigate={(idx) => scrollToScene(idx)}
            reportCompanion={{
              label: reportStyle.label,
              illustrationSrc: reportStyle.illustrationSrc,
              careerTitle: reportCareerTitle,
            }}
          />
        </div>
      ) : null}

      <CareerOverlay
        careerId={selectedCareerId}
        onClose={() => setSelectedCareerId(null)}
        onGoToCompare={() => {
          if (selectedCareerId) {
            const title = DATA2_TITLE_BY_CAREER_ID[selectedCareerId] ?? null;
            setCompareSeedTitles([title, null]);
            setCompareSeedKey((k) => k + 1);
          }
          setSelectedCareerId(null);
          scrollToScene(3);
        }}
        onGoToReport={() => {
          setDynamicReportCareer(null);
          setReportFocusId(selectedCareerId ?? reportCareerId);
          setHasReportInput(Boolean(selectedCareerId ?? reportCareerId));
          setSelectedCareerId(null);
          scrollToScene(4);
        }}
      />

    </main>
  );
}
