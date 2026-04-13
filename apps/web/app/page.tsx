"use client";
import Hero from "@/components/ui/animated-shader-hero";
import { BottomNav } from "@/components/ui/bottom-nav";
import { useState } from "react";

const scenes = ["Home", "Quiz", "Explore", "Compare", "Report"];

export default function Home() {
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <main style={{ background: "#020e06", minHeight: "100vh" }}>

      {/* ── Scene 0: Home — Shader Hero ── */}
      {activeIdx === 0 && (
        <Hero
          trustBadge={{
            text: "Career guidance for Victorian Year 10–12 students",
            icons: ["✦"],
          }}
          headline={{
            line1: "Find the career",
            line2: "you're built for",
          }}
          subtitle="Explore real careers, compare pathways, and get a personalised report — powered by live Australian labour market data."
          buttons={{
            primary: {
              text: "Take the quiz →",
              onClick: () => setActiveIdx(1),
            },
            secondary: {
              text: "Browse all careers",
              onClick: () => setActiveIdx(2),
            },
          }}
        />
      )}

      {/* ── Other scenes (placeholder) ── */}
      {activeIdx !== 0 && (
        <div style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,.6)",
          fontFamily: "sans-serif",
          gap: "1rem",
          background: "#040810",
          paddingBottom: "7rem",
        }}>
          <div style={{ fontSize: "1rem", letterSpacing: ".2em", textTransform: "uppercase", color: "#00c46a", opacity: .7 }}>
            Scene
          </div>
          <div style={{ fontSize: "4rem", fontWeight: 800, color: "#fff" }}>
            {scenes[activeIdx]}
          </div>
          <div style={{ fontSize: "1rem", color: "rgba(255,255,255,.35)" }}>
            Coming soon — navigate with the bottom bar
          </div>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <BottomNav activeIdx={activeIdx} onNavigate={setActiveIdx} />
    </main>
  );
}
