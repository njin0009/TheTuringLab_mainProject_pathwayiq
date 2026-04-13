"use client";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "Home",    idx: 0 },
  { label: "Quiz",    idx: 1 },
  { label: "Explore", idx: 2 },
  { label: "Compare", idx: 3 },
  { label: "Report",  idx: 4 },
];

interface BottomNavProps {
  activeIdx?: number;
  onNavigate?: (idx: number) => void;
}

export function BottomNav({ activeIdx = 0, onNavigate }: BottomNavProps) {
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "7rem",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.6rem",
        background: "rgba(4,8,18,0.97)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "0 2rem",
      }}
    >
      {NAV_ITEMS.map(({ label, idx }) => (
        <LiquidMetalButton
          key={idx}
          label={label}
          onClick={() => onNavigate?.(idx)}
        />
      ))}
    </nav>
  );
}
