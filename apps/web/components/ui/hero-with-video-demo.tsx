import { HeroWithVideo } from "@/components/ui/hero-with-video";

export function HeroWithVideoDemo() {
  return (
    <div className="w-full">
      <HeroWithVideo
        trustBadge={{
          text: "Trusted by forward-looking students.",
          icons: ["✦"],
        }}
        headline={{
          line1: "Find Your",
          line2: "Next Direction",
        }}
        subtitle="Preview the experience, then choose whether to start with a quiz, explore careers, or compare pathways."
        actionSlot={
          <button
            type="button"
            className="rounded-full bg-[linear-gradient(135deg,#f97316,#facc15)] px-8 py-4 text-base font-semibold text-[#1f1202]"
          >
            Start
          </button>
        }
      />
    </div>
  );
}
