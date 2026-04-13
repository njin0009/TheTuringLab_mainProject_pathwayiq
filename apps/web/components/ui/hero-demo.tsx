import ShaderShowcase from "@/components/ui/hero";

export default function HeroDemo() {
  return (
    <div className="min-h-screen h-full w-full">
      <ShaderShowcase
        trustBadge={{
          text: "New paper shader experience",
          icons: ["✦"],
        }}
        headline={{
          line1: "Beautiful",
          line2: "Pathway Experiences",
        }}
        subtitle="Explore the new mesh-gradient cover treatment in isolation before wiring it into the full journey."
      />
    </div>
  );
}
