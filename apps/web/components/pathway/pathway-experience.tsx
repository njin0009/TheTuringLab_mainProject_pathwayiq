"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { CareerOverlay } from "@/components/pathway/career-overlay";
import {
  PathwayWalker,
  type PathwayWalkerVariant,
} from "@/components/pathway/pathway-walker";
import { BottomNav } from "@/components/ui/bottom-nav";
import PasswordGateScreen from "@/components/ui/password-gate-screen";
import { useCareerSearch } from "@/hooks/useCareerSearch";
import { useQuizState } from "@/hooks/useQuizState";
import {
  CAREER_CARDS,
  DEFAULT_COMPARE,
  QUIZ_TO_INTEREST,
  SCENE_LABELS,
  type CareerId,
} from "@/lib/career-data";
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
    "Choose the card that sounds most like you on this page.",
    "When you're done, use Explore to open matching paths.",
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
const GATE_COVER_MS = 260;
const GATE_REVEAL_MS = 620;

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
  const walkerStateRef = useRef<WalkerState>({
    x: WALKER_START_X,
    facingRight: true,
  });
  const activeIdxRef = useRef(0);
  const walkerBubbleCursorRef = useRef<number[]>(WALKER_DIALOGUE.map(() => 0));
  const walkerMotionTimerRef = useRef<number | null>(null);
  const walkerBubbleTimerRef = useRef<number | null>(null);
  const walkerIntroTimerRef = useRef<number | null>(null);
  const walkerSequenceTimerRef = useRef<number | null>(null);
  const walkerAutoSceneRef = useRef<number | null>(null);
  const walkerAutoLineRef = useRef(0);
  const gateTimerRefs = useRef<number[]>([]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [showGate, setShowGate] = useState(true);
  const [gateTransitionPhase, setGateTransitionPhase] = useState<
    "idle" | "covering" | "revealing"
  >("idle");
  const [homeHeroVersion, setHomeHeroVersion] = useState(0);
  const [homePanelOpen, setHomePanelOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [walkerBubble, setWalkerBubble] = useState<WalkerBubbleState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeInterest, setActiveInterest] = useState<string | null>(null);
  const [selectedCareerId, setSelectedCareerId] = useState<CareerId | null>(null);
  const [reportFocusId, setReportFocusId] = useState<CareerId | null>(null);
  const [compareSelection, setCompareSelection] = useState<CareerId[]>(DEFAULT_COMPARE);
  const { selectedOption, selectOption } = useQuizState();
  const filteredCareers = useCareerSearch(searchQuery, activeInterest);

  const primaryCareer = filteredCareers[0] ?? CAREER_CARDS[0];
  const reportCareerId = reportFocusId ?? selectedCareerId ?? primaryCareer.id;
  const glow = SCENE_GLOWS[activeIdx] ?? SCENE_GLOWS[0];
  const brandColor = activeIdx === 0 ? "#22d3ee" : "#fb923c";
  const walkerVariant = WALKER_VARIANTS[activeIdx] ?? WALKER_VARIANTS[0];
  const isGateTransitioning = gateTransitionPhase !== "idle";
  const lockSceneControls = showGate || isGateTransitioning;
  const shouldRenderGateLayer = showGate || isGateTransitioning;
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
      gateTimerRefs.current.forEach((timer) => window.clearTimeout(timer));

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

  const playWalkerIntroSequence = useCallback((sceneIdx: number, lineIdx = 0) => {
    const lines = WALKER_DIALOGUE[sceneIdx] ?? WALKER_DIALOGUE[0];
    const safeIndex = Math.min(Math.max(lineIdx, 0), lines.length - 1);

    walkerAutoSceneRef.current = sceneIdx;
    walkerAutoLineRef.current = safeIndex;
    showWalkerBubble(lines[safeIndex], safeIndex + 1, lines.length);

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
  }, [isGateTransitioning, showGate, showWalkerBubble]);

  useEffect(() => {
    setWalkerBubble(null);
    clearWalkerBubbleTimers();

    if (showGate || isGateTransitioning) {
      return;
    }

    const sceneIdx = activeIdx;
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

  function handleQuizSelect(option: string) {
    selectOption(option);
    setActiveInterest(QUIZ_TO_INTEREST[option as keyof typeof QUIZ_TO_INTEREST]);
  }

  function handleCompareToggle(careerId: CareerId) {
    setCompareSelection((current) => {
      if (current.includes(careerId)) {
        return current.length === 1 ? current : current.filter((item) => item !== careerId);
      }

      if (current.length < 2) {
        return [...current, careerId];
      }

      return [current[1], careerId];
    });
  }

  function clearFilters() {
    setSearchQuery("");
    setActiveInterest(null);
  }

  function openCareer(careerId: CareerId) {
    setSelectedCareerId(careerId);
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
    const text = lines[nextCursor % lines.length];
    const currentStep = (nextCursor % lines.length) + 1;

    walkerBubbleCursorRef.current[sceneIdx] = (nextCursor + 1) % lines.length;
    showWalkerBubble(text, currentStep, lines.length);
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

      {!showGate ? (
        <header
          className={`pointer-events-none fixed inset-x-0 top-0 z-[180] flex items-center justify-between px-6 py-5 transition-all duration-500 ease-out md:px-10 ${chromeTransitionClass}`}
        >
          <div className="text-2xl font-semibold tracking-tight" style={{ color: brandColor }}>
            Pathway<span className="text-white">IQ</span>
          </div>
          <div className="hidden rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300 md:block">
            Bottom rider flow restored
          </div>
        </header>
      ) : null}

      <div
        ref={scrollRef}
        className={`no-scrollbar relative flex h-screen overflow-hidden transition-[opacity,transform] duration-[680ms] ease-out ${
          showGate
            ? "pointer-events-none translate-y-3 opacity-0"
            : gateTransitionPhase === "revealing"
              ? "pointer-events-none translate-y-0 opacity-100"
              : "translate-y-0 opacity-100"
        }`}
        style={{ touchAction: "pan-y" }}
      >
        <HomeScene
          heroVersion={homeHeroVersion}
          panelVisible={homePanelOpen}
          onStart={() => setHomePanelOpen(true)}
          onBack={() => setHomePanelOpen(false)}
          onTakeQuiz={() => scrollToScene(1)}
          onExplore={() => scrollToScene(2)}
          onCompare={() => scrollToScene(3)}
        />
        <QuizScene
          selectedOption={selectedOption}
          onSelectOption={handleQuizSelect}
          onExplore={() => scrollToScene(2)}
        />
        <ExploreScene
          careers={filteredCareers}
          searchQuery={searchQuery}
          activeInterest={activeInterest}
          onSearchChange={setSearchQuery}
          onSelectInterest={setActiveInterest}
          onOpenCareer={openCareer}
          onCompare={() => scrollToScene(3)}
          onClearFilters={clearFilters}
        />
        <CompareScene
          selectedCareerIds={compareSelection}
          onToggleCareer={handleCompareToggle}
          onOpenCareer={openCareer}
          onReport={() => scrollToScene(4)}
        />
        <ReportScene
          careerId={reportCareerId}
          onOpenCareer={openCareer}
          onCompare={() => scrollToScene(3)}
          onRestart={() => {
            setReportFocusId(null);
            setHomePanelOpen(false);
            scrollToScene(0);
          }}
        />
      </div>

      {!showGate ? (
        <div className={`transition-all duration-500 ease-out ${chromeTransitionClass}`}>
          <PathwayWalker
            ref={walkerRef}
            variant={walkerVariant}
            bubble={walkerBubble}
            onTalk={handleWalkerTalk}
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
          <BottomNav activeIdx={activeIdx} onNavigate={(idx) => scrollToScene(idx)} />
        </div>
      ) : null}

      <CareerOverlay
        careerId={selectedCareerId}
        onClose={() => setSelectedCareerId(null)}
        onGoToCompare={() => {
          if (selectedCareerId) {
            handleCompareToggle(selectedCareerId);
          }
          setSelectedCareerId(null);
          scrollToScene(3);
        }}
        onGoToReport={() => {
          setReportFocusId(selectedCareerId ?? reportCareerId);
          setSelectedCareerId(null);
          scrollToScene(4);
        }}
      />

      {shouldRenderGateLayer ? (
        <div
          className={`fixed inset-0 z-[400] transition-opacity duration-[520ms] ease-out ${
            showGate && gateTransitionPhase === "idle"
              ? "opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <PasswordGateScreen
            onUnlock={() => {
              setGateTransitionPhase("covering");
              gateTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
              gateTimerRefs.current = [
                window.setTimeout(() => {
                  setShowGate(false);
                  scrollToScene(0, { nextWalkerX: WALKER_START_X, faceRight: true });
                  window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                      setGateTransitionPhase("revealing");
                    });
                  });
                }, GATE_COVER_MS),
                window.setTimeout(() => {
                  setGateTransitionPhase("idle");
                }, GATE_COVER_MS + GATE_REVEAL_MS),
              ];
            }}
          />
        </div>
      ) : null}

      {isGateTransitioning ? (
        <div
          className={`pointer-events-none fixed inset-0 z-[450] transition-opacity duration-[680ms] ease-out ${
            gateTransitionPhase === "covering" ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_50%_68%,rgba(249,115,22,0.1),transparent_26%),linear-gradient(180deg,rgba(1,4,10,0.12),rgba(1,4,10,0.84)_46%,rgba(1,4,10,0.98))]" />
          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-6">
            <div className="rounded-full border border-white/10 bg-black/28 px-6 py-3 text-sm font-medium tracking-[0.28em] text-white/78 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
              ENTERING PATHWAYIQ
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
