"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { CareerOverlay } from "@/components/pathway/career-overlay";
import {
  PathwayWalker,
  type PathwayWalkerVariant,
} from "@/components/pathway/pathway-walker";
import { BottomNav } from "@/components/ui/bottom-nav";
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

const WALKER_VARIANTS: PathwayWalkerVariant[] = [
  {
    src: "/undraw-scooter.svg",
    width: 800,
    height: 758,
    className: "h-[130px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.26)]",
  },
  {
    src: "/undraw-hiking.svg",
    width: 1045,
    height: 792,
    className: "h-[132px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.26)]",
  },
  {
    src: "/undraw-party.svg",
    width: 364,
    height: 581,
    className: "h-[128px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.26)]",
  },
  {
    src: "/undraw-with-love.svg",
    width: 681,
    height: 800,
    className: "h-[134px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.26)]",
  },
  {
    src: "/undraw-learning.svg",
    width: 394,
    height: 800,
    className: "h-[136px] w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.28)]",
    mirroredByDefault: true,
  },
] as const;

const WALKER_START_X = 80;
const WALKER_JUMP_VEL = 18;
const WALKER_GRAVITY = 1.2;
const WALKER_GROUND_Y = 0;

const INTERACTIVE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON"]);

interface WalkerState {
  x: number;
  y: number;
  velY: number;
  facingRight: boolean;
  isMoving: boolean;
  isJumping: boolean;
  keys: Record<string, boolean>;
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
    y: 0,
    velY: 0,
    facingRight: true,
    isMoving: false,
    isJumping: false,
    keys: {},
  });
  const activeIdxRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const navTweenRef = useRef<number | null>(null);
  const directionLatchRef = useRef({ left: false, right: false });

  const [activeIdx, setActiveIdx] = useState(0);
  const [homeHeroVersion, setHomeHeroVersion] = useState(0);
  const [homePanelOpen, setHomePanelOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
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

  const getContainer = () => scrollRef.current;
  const getSceneWidth = () => getContainer()?.clientWidth || window.innerWidth;

  const getDockedWalkerPosition = () => {
    const button = document.querySelector<HTMLElement>(
      `[data-nav-item='${activeIdxRef.current}']`,
    );
    if (!button) {
      return null;
    }

    const rect = button.getBoundingClientRect();
    return {
      left: rect.left + rect.width / 2,
      bottom: window.innerHeight - rect.top + 10,
    };
  };

  const renderWalker = () => {
    const walker = walkerRef.current;
    const container = getContainer();
    if (!walker || !container) {
      return;
    }

    const state = walkerStateRef.current;
    const viewWidth = container.clientWidth || window.innerWidth;
    const clampedX = Math.max(56, Math.min(viewWidth - 56, state.x));

    if (!state.isMoving && !state.isJumping && state.x === WALKER_START_X) {
      const dockedPosition = getDockedWalkerPosition();
      if (dockedPosition) {
        walker.style.left = `${dockedPosition.left}px`;
        walker.style.bottom = `${dockedPosition.bottom}px`;
      } else {
        walker.style.left = `${clampedX}px`;
        walker.style.bottom = `calc(7rem + ${Math.max(0, state.y)}px)`;
      }
    } else {
      walker.style.left = `${clampedX}px`;
      walker.style.bottom = `calc(7rem + ${Math.max(0, state.y)}px)`;
    }
    walker.classList.toggle("walker-walking", state.isMoving);
    walker.classList.toggle("walker-idle", !state.isMoving);

    const flipTarget = walker.querySelector(".walker-flip");
    if (flipTarget instanceof HTMLElement) {
      const defaultScale = Number(flipTarget.dataset.defaultScale ?? "1");
      flipTarget.style.transform = `scaleX(${state.facingRight ? defaultScale : -defaultScale})`;
      flipTarget.style.transformOrigin = "center center";
    }
  };

  const maybeTransitionSceneByWalker = () => {
    if (navTweenRef.current !== null) {
      return false;
    }

    const state = walkerStateRef.current;
    if (selectedCareerId || state.isJumping) {
      return false;
    }

    const currentIdx = activeIdxRef.current;
    const movingRight = state.keys.ArrowRight || state.keys.KeyD;
    const movingLeft = state.keys.ArrowLeft || state.keys.KeyA;

    if (!movingRight) {
      directionLatchRef.current.right = false;
    }

    if (!movingLeft) {
      directionLatchRef.current.left = false;
    }

    if (movingRight) {
      if (directionLatchRef.current.right) {
        return false;
      }

      directionLatchRef.current.right = true;
      const nextIdx = currentIdx === SCENE_LABELS.length - 1 ? 0 : currentIdx + 1;
      if (currentIdx === SCENE_LABELS.length - 1) {
        setReportFocusId(null);
        setHomePanelOpen(false);
      }
      scrollToScene(nextIdx, {
        nextWalkerX: WALKER_START_X,
        faceRight: true,
      });
      return true;
    }

    if (movingLeft && currentIdx > 0) {
      if (directionLatchRef.current.left) {
        return false;
      }

      directionLatchRef.current.left = true;
      scrollToScene(currentIdx - 1, {
        nextWalkerX: WALKER_START_X,
        faceRight: false,
      });
      return true;
    }

    return false;
  };

  function scrollToScene(
    idx: number,
    options?: {
      nextWalkerX?: number;
      faceRight?: boolean;
    },
  ) {
    const container = getContainer();
    if (!container) {
      return;
    }

    if (idx === 0 && activeIdxRef.current !== 0) {
      setHomeHeroVersion((current) => current + 1);
    }

    if (navTweenRef.current !== null) {
      cancelAnimationFrame(navTweenRef.current);
      navTweenRef.current = null;
    }

    const sceneWidth = getSceneWidth();
    const targetScroll = idx * sceneWidth;
    const state = walkerStateRef.current;
    state.facingRight = options?.faceRight ?? idx >= activeIdxRef.current;
    state.x = options?.nextWalkerX ?? WALKER_START_X;
    state.y = WALKER_GROUND_Y;
    state.velY = 0;
    state.isJumping = false;
    state.isMoving = false;

    container.scrollTo({ left: targetScroll, behavior: "auto" });
    activeIdxRef.current = idx;
    startTransition(() => setActiveIdx(idx));
    setShowHint(false);
    renderWalker();
  }

  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    const container = getContainer();
    if (!container) {
      return;
    }

    const state = walkerStateRef.current;
    state.x = WALKER_START_X;
    container.scrollTo({ left: activeIdxRef.current * getSceneWidth(), behavior: "auto" });
    renderWalker();

    const movementCodes = new Set([
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "Space",
      "KeyA",
      "KeyD",
      "KeyW",
    ]);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveElement(event.target)) {
        return;
      }

      if (event.key === "Escape" && selectedCareerId) {
        setSelectedCareerId(null);
        return;
      }

      if (selectedCareerId || !movementCodes.has(event.code)) {
        return;
      }

      state.keys[event.code] = true;
      setShowHint(false);

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) {
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!movementCodes.has(event.code)) {
        return;
      }

      state.keys[event.code] = false;
    };

    const tick = () => {
      let moving = false;

      if (navTweenRef.current === null && !selectedCareerId) {
        state.x = WALKER_START_X;

        if ((state.keys.ArrowUp || state.keys.Space || state.keys.KeyW) && !state.isJumping) {
          state.velY = WALKER_JUMP_VEL;
          state.isJumping = true;
        }
      }

      if (state.isJumping || state.y > 0) {
        state.velY -= WALKER_GRAVITY;
        state.y += state.velY;

        if (state.y <= WALKER_GROUND_Y) {
          state.y = WALKER_GROUND_Y;
          state.velY = 0;
          state.isJumping = false;
        }

        moving = true;
      }

      if (maybeTransitionSceneByWalker()) {
        gameLoopRef.current = requestAnimationFrame(tick);
        return;
      }

      if (navTweenRef.current === null) {
        state.isMoving = moving;
        if (moving || Object.values(state.keys).some(Boolean)) {
          renderWalker();
        }
      }

      gameLoopRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    gameLoopRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);

      if (gameLoopRef.current !== null) {
        cancelAnimationFrame(gameLoopRef.current);
      }

      if (navTweenRef.current !== null) {
        cancelAnimationFrame(navTweenRef.current);
      }
    };
  }, [selectedCareerId]);

  useEffect(() => {
    const handleResize = () => {
      const state = walkerStateRef.current;
      state.x = WALKER_START_X;
      scrollToScene(activeIdxRef.current);
      renderWalker();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

      <header className="pointer-events-none fixed inset-x-0 top-0 z-[180] flex items-center justify-between px-6 py-5 md:px-10">
        <div className="text-2xl font-semibold tracking-tight" style={{ color: brandColor }}>
          Pathway<span className="text-white">IQ</span>
        </div>
        <div className="hidden rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300 md:block">
          Bottom rider flow restored
        </div>
      </header>

      <div
        ref={scrollRef}
        className="no-scrollbar relative flex h-screen overflow-hidden"
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

      <PathwayWalker ref={walkerRef} variant={walkerVariant} />

      {showHint ? (
        <div className="pointer-events-none fixed bottom-32 right-6 z-[190] hidden rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-300 md:flex">
          A / D or {"< >"} to ride, W / Space to hop
        </div>
      ) : null}

      <div className="pointer-events-none fixed right-6 top-20 z-[190] hidden rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-400 md:flex">
        {SCENE_LABELS[activeIdx]}
      </div>

      <BottomNav activeIdx={activeIdx} onNavigate={(idx) => scrollToScene(idx)} />

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
    </main>
  );
}
