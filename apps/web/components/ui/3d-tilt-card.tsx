import Image from "next/image";
import React, { useRef, useState } from "react";

export interface TiltCardProps {
  eyebrow: string;
  title: string;
  tagline: string;
  imageUrl: string;
  accentClassName: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function TiltCard({
  eyebrow,
  title,
  tagline,
  imageUrl,
  accentClassName,
  actionLabel,
  onAction,
}: TiltCardProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) {
      return;
    }

    const rect = cardRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = ((y - centerY) / centerY) * -10;
    const tiltY = ((x - centerX) / centerX) * 10;

    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const shadowX = tilt.y * 0.45;
  const shadowY = tilt.x * 0.45;
  const shadowBlur = 28 + Math.abs(tilt.x + tilt.y) * 0.8;

  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))] blur-xl" />
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full cursor-pointer overflow-hidden rounded-[30px] border border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(225,229,238,0.88))] p-6 transition-transform duration-200 ease-out"
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.015, 1.015, 1.015)`,
          boxShadow: `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(15, 23, 42, 0.32)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.9),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.45),transparent_30%)] opacity-90" />

        <div className="relative z-10">
          <div className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
            {eyebrow}
          </div>
          <div className={["mt-4 text-4xl font-semibold tracking-tight", accentClassName].join(" ")}>
            {title}
          </div>
        </div>

        <div className="relative z-10 mt-6 overflow-hidden rounded-[24px] bg-white/92 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.8),transparent_35%)]" />
          <div className="relative flex justify-center">
            <Image
              src={imageUrl}
              alt={title}
              width={320}
              height={220}
              className="h-auto w-full max-w-[260px]"
            />
          </div>
        </div>

        {actionLabel ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAction?.();
            }}
            className="relative z-10 mt-4 w-full rounded-full bg-emerald-500/90 px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_24px_rgba(16,185,129,0.2)] transition hover:bg-emerald-400"
          >
            {actionLabel}
          </button>
        ) : (
          <div className="relative z-10 mt-4 rounded-full bg-emerald-500/90 px-4 py-2 text-center text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_12px_24px_rgba(16,185,129,0.2)]">
            {title}
          </div>
        )}
        <p className="relative z-10 mt-3 text-center text-sm leading-6 text-slate-700">{tagline}</p>
      </div>
    </div>
  );
}
