import Image from "next/image";
import { CAREER_PROFILES } from "@/lib/career-data";
import type {
  QuizAnswerMap,
  QuizModeDefinition,
  QuizModeId,
  QuizQuestion,
  QuizResult,
} from "@/lib/quiz-data";
import type { QuizPhase } from "@/hooks/useQuizState";

interface QuizSceneProps {
  phase: QuizPhase;
  mode: QuizModeId | null;
  modes: QuizModeDefinition[];
  questions: QuizQuestion[];
  answers: QuizAnswerMap;
  currentQuestion: QuizQuestion | null;
  currentQuestionIndex: number;
  questionNumber: number;
  selectedOptionId: string | null;
  progressPercent: number;
  hasAnsweredCurrent: boolean;
  canGoBack: boolean;
  result: QuizResult | null;
  onChooseMode: (mode: QuizModeId) => void;
  onChooseOption: (optionId: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onRestartMode: () => void;
  onSwitchMode: (mode: QuizModeId) => void;
  onResetQuiz: () => void;
  onExplore: (result: QuizResult) => void;
}

function getModeTheme(mode: QuizModeId | null) {
  if (mode === "deep") {
    return {
      chip: "border-fuchsia-300/24 bg-fuchsia-400/10 text-fuchsia-100",
      panel: "border-fuchsia-400/22 bg-gradient-to-br from-fuchsia-500/14 via-orange-400/10 to-white/[0.05]",
      progress: "bg-gradient-to-r from-fuchsia-400 via-orange-300 to-amber-300",
      questionCard: "border-fuchsia-400/18 from-fuchsia-500/14 via-white/[0.04] to-transparent",
      selectedOption:
        "border-fuchsia-300/38 bg-fuchsia-400/16 text-white shadow-[0_12px_34px_rgba(217,70,239,0.18)]",
      primaryButton:
        "bg-gradient-to-r from-fuchsia-500 to-orange-500 shadow-[0_14px_34px_rgba(217,70,239,0.24)]",
      accentText: "text-fuchsia-200",
      modeLabel: "Deeper Read",
    };
  }

  return {
    chip: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
    panel: "border-cyan-400/22 bg-gradient-to-br from-cyan-500/14 via-sky-400/10 to-white/[0.05]",
    progress: "bg-gradient-to-r from-cyan-400 via-cyan-300 to-sky-300",
    questionCard: "border-cyan-400/18 from-cyan-500/14 via-white/[0.04] to-transparent",
    selectedOption:
      "border-cyan-300/38 bg-cyan-400/16 text-white shadow-[0_12px_34px_rgba(34,211,238,0.12)]",
    primaryButton:
      "bg-gradient-to-r from-cyan-500 to-sky-500 shadow-[0_14px_34px_rgba(6,182,212,0.24)]",
    accentText: "text-cyan-200",
    modeLabel: "Fast Start",
  };
}

function ModeCard({
  mode,
  onChoose,
}: {
  mode: QuizModeDefinition;
  onChoose: (mode: QuizModeId) => void;
}) {
  const theme = getModeTheme(mode.id);

  return (
    <button
      type="button"
      onClick={() => onChoose(mode.id)}
      className={[
        "group rounded-[28px] border p-6 text-left shadow-[0_24px_80px_rgba(0,0,0,0.24)] transition hover:translate-y-[-2px]",
        theme.panel,
      ].join(" ")}
    >
      <div
        className={[
          "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]",
          theme.chip,
        ].join(" ")}
      >
        {theme.modeLabel}
      </div>
      <div className="mt-5 text-2xl font-semibold text-white">{mode.title}</div>
      <p className="mt-2 text-sm text-slate-300">{mode.duration}</p>
      <p className="mt-5 text-base leading-7 text-slate-200">{mode.blurb}</p>
      <p className="mt-4 text-sm text-slate-400">{mode.helper}</p>
      <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white">
        <span>Start this version</span>
        <span aria-hidden className="transition group-hover:translate-x-1">
          →
        </span>
      </div>
    </button>
  );
}

function ResultCareerCard({ careerId }: { careerId: keyof typeof CAREER_PROFILES }) {
  const profile = CAREER_PROFILES[careerId];

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
        {profile.badge}
      </div>
      <div className="mt-4 flex items-start gap-3">
        <div className="text-2xl">{profile.icon}</div>
        <div>
          <div className="text-xl font-semibold text-white">{profile.title}</div>
          <div className="mt-1 text-sm text-cyan-100">{profile.salary}</div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{profile.summary}</p>
    </div>
  );
}

export default function QuizScene({
  phase,
  mode,
  modes,
  questions,
  answers,
  currentQuestion,
  currentQuestionIndex,
  questionNumber,
  selectedOptionId,
  progressPercent,
  hasAnsweredCurrent,
  canGoBack,
  result,
  onChooseMode,
  onChooseOption,
  onNext,
  onPrevious,
  onRestartMode,
  onSwitchMode,
  onResetQuiz,
  onExplore,
}: QuizSceneProps) {
  const activeMode = mode ? modes.find((entry) => entry.id === mode) ?? null : null;
  const activeTheme = getModeTheme(mode);
  const alternateMode = mode === "quick" ? "deep" : "quick";
  const resultTheme = getModeTheme(result?.mode ?? null);

  return (
    <section className="relative h-screen w-screen shrink-0 snap-start overflow-hidden px-6 pb-36 pt-28">
      <div className="mx-auto grid min-h-full max-w-6xl gap-10 lg:grid-cols-[0.94fr_1.06fr] lg:items-start">
        <div className="space-y-6">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#00c46a]">
            Scene 02
          </div>
          <h2 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Find a work style that feels like you.
          </h2>
          <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            This draft quiz turns a few quick choices into a career-style read, then points you
            toward matching directions inside PathwayIQ.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                What this gives you
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                A top work style, a support style, and a starting set of career directions to
                explore next.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-200">
                Important note
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                This is a starting point, not a final label. Use it to narrow the next jobs you
                want to inspect.
              </p>
            </div>
          </div>

          {phase === "question" && activeMode && currentQuestion ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className={["text-xs font-semibold uppercase tracking-[0.24em]", activeTheme.accentText].join(" ")}>
                    {activeMode.title}
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    Question {questionNumber} of {questions.length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onResetQuiz}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/22 hover:bg-white/[0.08]"
                >
                  Change version
                </button>
              </div>
              <div className="mt-5 h-2 rounded-full bg-white/8">
                <div
                  className={`h-full rounded-full ${activeTheme.progress} transition-[width] duration-300`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-6 rounded-[22px] border border-white/8 bg-black/18 p-5">
                <div className="text-lg font-semibold text-white">{currentQuestion.prompt}</div>
                <p className="mt-3 text-sm leading-7 text-slate-300">{currentQuestion.helper}</p>
                <div className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">
                  Saved answers: {Object.keys(answers).length}
                </div>
              </div>
            </div>
          ) : null}

          {phase === "result" && result ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={[
                    "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]",
                    resultTheme.chip,
                  ].join(" ")}
                >
                  {result.mode === "quick" ? "Quick Match" : "Deep Match"}
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                  {result.totalQuestions} answers used
                </div>
              </div>
              <div className="mt-5 text-4xl font-semibold tracking-tight text-white">
                {result.archetypeTitle}
              </div>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                {result.archetypeSummary}
              </p>

              <div
                className={[
                  "mt-6 overflow-hidden rounded-[26px] border p-5",
                  result.topStyle.surfaceClassName,
                ].join(" ")}
              >
                <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
                  <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white/70 p-4">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.6),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.35),transparent_40%)]" />
                    <div className="relative">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Your strongest style
                      </div>
                      <div
                        className={[
                          "mt-3 text-2xl font-semibold",
                          result.topStyle.lightCardColorClassName,
                        ].join(" ")}
                      >
                        {result.topStyle.label}
                      </div>
                    </div>
                    <div className="relative mt-4 flex justify-center">
                      <Image
                        src={result.topStyle.illustrationSrc}
                        alt={result.topStyle.label}
                        width={340}
                        height={240}
                        className="h-auto w-full max-w-[260px]"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-200/85">
                      Top style
                    </div>
                    <div
                      className={[
                        "mt-2 text-3xl font-semibold",
                        result.topStyle.colorClassName,
                      ].join(" ")}
                    >
                      {result.topStyle.label}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-200/90">{result.topStyle.tagline}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-200/90">{result.topStyle.summary}</p>
                    <div className="mt-4 rounded-[20px] border border-white/10 bg-black/16 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                        Support style
                      </div>
                      <div
                        className={[
                          "mt-2 text-xl font-semibold",
                          result.supportStyle.colorClassName,
                        ].join(" ")}
                      >
                        {result.supportStyle.label}
                      </div>
                      <p className="mt-2 text-sm leading-7 text-slate-200/85">
                        {result.supportStyle.tagline}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-7 shadow-[0_28px_90px_rgba(0,0,0,0.3)] backdrop-blur-xl">
          {phase === "mode" ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#00c46a]">
                Choose your version
              </div>
              <div className="mt-4 text-3xl font-semibold leading-tight text-white">
                Start with a fast read or a deeper career-style check.
              </div>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                Both versions use the same PathwayIQ dimensions, but the deeper one gives the
                result page more evidence before it recommends directions.
              </p>
              <div className="mt-8 grid gap-5">
                {modes.map((entry) => (
                  <ModeCard key={entry.id} mode={entry} onChoose={onChooseMode} />
                ))}
              </div>
            </>
          ) : null}

          {phase === "question" && activeMode && currentQuestion ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  className={[
                    "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]",
                    activeTheme.chip,
                  ].join(" ")}
                >
                  {activeMode.title}
                </div>
                <div className="text-sm text-slate-400">{activeMode.duration}</div>
              </div>

              <div
                className={[
                  "mt-6 rounded-[24px] border bg-gradient-to-br p-6",
                  activeTheme.questionCard,
                ].join(" ")}
              >
                <div className="text-2xl font-semibold leading-tight text-white md:text-[2rem]">
                  {currentQuestion.prompt}
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 md:text-[15px]">
                  {currentQuestion.helper}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                {currentQuestion.options.map((option, optionIndex) => {
                  const selected = selectedOptionId === option.id;
                  const optionBadge = String.fromCharCode(65 + optionIndex);

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onChooseOption(option.id)}
                      className={[
                        "rounded-[22px] border px-5 py-4 text-left transition",
                        selected
                          ? activeTheme.selectedOption
                          : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/22 hover:bg-white/[0.08]",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={[
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold uppercase tracking-[0.16em]",
                            selected
                              ? "border-white/25 bg-white/18 text-white"
                              : "border-white/10 bg-black/18 text-slate-300",
                          ].join(" ")}
                        >
                          {optionBadge}
                        </div>
                        <div className="min-w-0">
                          <div className="text-lg font-semibold leading-7 text-white md:text-[1.15rem]">
                            {option.label}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-400">
                            {option.helper}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onPrevious}
                  disabled={!canGoBack}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-white/22 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onRestartMode}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-white/22 hover:bg-white/[0.08]"
                  >
                    Restart this version
                  </button>
                  <button
                    type="button"
                    onClick={onNext}
                    disabled={!hasAnsweredCurrent}
                    className={[
                      "rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-40",
                      activeTheme.primaryButton,
                    ].join(" ")}
                  >
                    {currentQuestionIndex === questions.length - 1 ? "See my result" : "Next question"}
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {phase === "result" && result ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#00c46a]">
                  Your result
                </div>
                <button
                  type="button"
                  onClick={onResetQuiz}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/22 hover:bg-white/[0.08]"
                >
                  Choose another version
                </button>
              </div>

              <div className="mt-6 rounded-[24px] border border-white/10 bg-black/18 p-6">
                <div className="text-sm font-medium text-white">
                  You may enjoy work that feels like:
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.topStyle.workLikes.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-slate-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-7 text-slate-300">{result.topStyle.summary}</p>
              </div>

              <div className="mt-6 space-y-3">
                {result.scoreBreakdown.map((entry) => (
                  <div key={entry.dimension} className="rounded-[18px] border border-white/8 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-100">{entry.label}</div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        {entry.score} pts
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/8">
                      <div
                        className={`h-full rounded-full ${resultTheme.progress}`}
                        style={{ width: `${entry.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Recommended starting roles
                </div>
                <div className="mt-4 grid gap-4">
                  {result.recommendedCareerIds.map((careerId) => (
                    <ResultCareerCard key={careerId} careerId={careerId} />
                  ))}
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onExplore(result)}
                  className={[
                    "rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px]",
                    resultTheme.primaryButton,
                  ].join(" ")}
                >
                  Open matching careers in Explore
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchMode(alternateMode)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-white/22 hover:bg-white/[0.08]"
                >
                  {mode === "quick" ? "Try the deeper quiz" : "Try the quick version"}
                </button>
                <button
                  type="button"
                  onClick={onRestartMode}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-white/22 hover:bg-white/[0.08]"
                >
                  Retake this version
                </button>
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-400">
                We will prefill Explore with <span className="text-slate-200">{result.exploreSearch}</span>{" "}
                and your strongest matching direction.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
