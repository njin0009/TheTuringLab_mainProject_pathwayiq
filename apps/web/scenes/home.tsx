import ShaderShowcase from "@/components/ui/hero";
import {
  PathChoiceDeck,
  type PathChoiceItem,
} from "@/components/ui/testimonial-cards";

interface HomeSceneProps {
  heroVersion: number;
  panelVisible: boolean;
  onStart: () => void;
  onBack: () => void;
  onTakeQuiz: () => void;
  onExplore: () => void;
  onCompare: () => void;
}

export default function HomeScene({
  heroVersion,
  panelVisible,
  onStart,
  onBack,
  onTakeQuiz,
  onExplore,
  onCompare,
}: HomeSceneProps) {
  const pathChoiceItems: PathChoiceItem[] = [
    {
      id: "quiz",
      title: "Quiz",
      description: "Answer a few guided questions and get matched roles you can explore next.",
      eyebrow: "Guided start",
      accentClassName: "border-cyan-400/24 bg-cyan-400/12",
      onSelect: onTakeQuiz,
    },
    {
      id: "explore",
      title: "Explore",
      description: "Browse pathways and career cards at your own pace without committing first.",
      eyebrow: "Open browse",
      accentClassName: "border-white/16 bg-white/[0.06]",
      onSelect: onExplore,
    },
    {
      id: "compare",
      title: "Compare",
      description: "Jump straight into side-by-side trade-offs when you already have options in mind.",
      eyebrow: "Fast track",
      accentClassName: "border-orange-300/24 bg-orange-400/12",
      onSelect: onCompare,
    },
  ];

  return (
    <section className="relative h-screen w-screen shrink-0 snap-start overflow-hidden">
      <ShaderShowcase
        refreshToken={heroVersion}
        trustBadge={{
          text: "Career guidance for Victorian Year 10-12 students",
          icons: ["✦"],
        }}
        headline={{
          line1: "Find the career",
          line2: "you are built for future",
        }}
        subtitle="Create a clearer pathway into careers, compare options with confidence, and start the journey in the way that suits you best."
        actionSlot={
          !panelVisible ? (
            <button
              type="button"
              onClick={onStart}
              className="rounded-full border border-cyan-400/35 bg-gradient-to-r from-cyan-500 to-orange-500 px-10 py-4 text-base font-semibold text-white shadow-[0_18px_56px_rgba(6,182,212,0.22)] transition hover:translate-y-[-1px] hover:shadow-[0_22px_64px_rgba(249,115,22,0.28)]"
            >
              Start
            </button>
          ) : null
        }
      />

      {panelVisible ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/36 backdrop-blur-[2px]" />
          <div className="pointer-events-auto relative w-full max-w-5xl rounded-[34px] border border-cyan-400/16 bg-[#071018]/78 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-xl">
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
                  Choose Your Path
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-white md:text-4xl">
                  Start the journey in the way that feels right first.
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/72 md:text-base">
                  Swipe through the stack or open one directly. Each card keeps the same layered style, but now it points straight into your real flow.
                </p>
              </div>
              <button
                type="button"
                onClick={onBack}
                className="w-fit rounded-full border border-cyan-400/18 px-4 py-2 text-sm font-medium text-cyan-50 transition hover:border-cyan-400/32 hover:bg-cyan-400/8"
              >
                {"<-"} Back
              </button>
            </div>
            <div className="mt-2">
              <PathChoiceDeck items={pathChoiceItems} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
