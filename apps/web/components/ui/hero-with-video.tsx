"use client";

import React, { useRef, useState } from "react";
import { motion, useSpring } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeroWithVideoProps {
  trustBadge?: {
    text: string;
    icons?: string[];
  };
  headline: {
    line1: string;
    line2: string;
  };
  subtitle: string;
  backgroundImage?: string;
  videoUrl?: string;
  mediaEyebrow?: string;
  mediaCaption?: string;
  actionSlot?: React.ReactNode;
  className?: string;
}

export function HeroWithVideo({
  trustBadge,
  headline,
  subtitle,
  backgroundImage = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2072&q=80",
  videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  mediaEyebrow = "Career Explorer Preview",
  mediaCaption = "Preview the journey before you choose how to begin.",
  actionSlot,
  className,
}: HeroWithVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const glowX = useSpring(-999, { stiffness: 120, damping: 22, mass: 0.7 });
  const glowY = useSpring(-999, { stiffness: 120, damping: 22, mass: 0.7 });
  const [showGlow, setShowGlow] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(false);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    glowX.set(event.clientX - bounds.left - 176);
    glowY.set(event.clientY - bounds.top - 176);
    if (!showGlow) {
      setShowGlow(true);
    }
  };

  const handlePointerLeave = () => {
    setShowGlow(false);
  };

  const handlePlayVideo = async () => {
    if (!videoRef.current) {
      return;
    }

    try {
      await videoRef.current.play();
      setIsVideoPlaying(true);
      setIsVideoPaused(false);
    } catch {
      setIsVideoPlaying(false);
    }
  };

  const handlePauseVideo = () => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.pause();
    setIsVideoPaused(true);
  };

  const handleResumeVideo = async () => {
    if (!videoRef.current) {
      return;
    }

    try {
      await videoRef.current.play();
      setIsVideoPaused(false);
    } catch {
      setIsVideoPaused(true);
    }
  };

  const handleVideoEnded = () => {
    setIsVideoPlaying(false);
    setIsVideoPaused(false);
  };

  return (
    <div
      className={cn(
        "relative h-screen w-full overflow-hidden bg-[#040404]",
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#080808_0%,#050505_48%,#030303_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(249,115,22,0.08),transparent_22%,transparent_78%,rgba(250,204,21,0.06))]" />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute z-[12] size-[24rem] rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.24)_0%,rgba(249,115,22,0.14)_34%,rgba(245,158,11,0.06)_54%,transparent_72%)] blur-3xl"
        style={{ x: glowX, y: glowY }}
        animate={{ opacity: showGlow ? 1 : 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      />

      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_14%,rgba(251,191,36,0.08),transparent_18%),linear-gradient(to_bottom,rgba(0,0,0,0.06),transparent_28%,rgba(0,0,0,0.7))]" />

      <div className="relative z-20 mx-auto flex h-full max-w-6xl flex-col px-6 pb-32 pt-24 md:px-10">
        <div className="mx-auto w-full max-w-3xl text-center">
          {trustBadge ? (
            <div className="mb-6 flex justify-center">
              <div className="flex items-center gap-2 rounded-full border border-[#fdba74]/25 bg-[#f97316]/8 px-5 py-2.5 text-sm text-[#ffedd5] backdrop-blur-md">
                {trustBadge.icons?.map((icon, index) => (
                  <span key={`${icon}-${index}`}>{icon}</span>
                ))}
                <span>{trustBadge.text}</span>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <h1
              className="text-4xl font-bold tracking-tight text-[#fdba74] md:text-6xl lg:text-7xl"
              style={{ textShadow: "0 0 28px rgba(251,191,36,0.18)" }}
            >
              {headline.line1}
            </h1>
            <h2
              className="text-4xl font-bold tracking-tight text-[#f59e0b] md:text-6xl lg:text-7xl"
              style={{ textShadow: "0 0 28px rgba(249,115,22,0.18)" }}
            >
              {headline.line2}
            </h2>
          </div>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#ffedd5]/82 md:text-lg">
            {subtitle}
          </p>

          {actionSlot ? <div className="mt-8 flex justify-center">{actionSlot}</div> : null}
        </div>

        <div className="mx-auto mt-10 w-full max-w-5xl">
          <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.03] p-3 shadow-[0_32px_100px_rgba(0,0,0,0.55)] backdrop-blur-sm">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[1.6rem] border border-white/8 bg-black">
              <div
                className={cn(
                  "absolute inset-0 bg-cover bg-center transition-opacity duration-500",
                  isVideoPlaying ? "opacity-0" : "opacity-100",
                )}
                style={{ backgroundImage: `url("${backgroundImage}")` }}
              />

              <video
                ref={videoRef}
                src={videoUrl}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                  isVideoPlaying ? "opacity-100" : "opacity-0",
                )}
                onEnded={handleVideoEnded}
                playsInline
                muted
              />

              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.1),transparent_28%,rgba(0,0,0,0.45)_100%)]" />

              <div className="absolute left-5 top-5 rounded-full border border-white/12 bg-black/35 px-4 py-2 text-xs font-medium uppercase tracking-[0.26em] text-[#fff1df]/86 backdrop-blur-md">
                {mediaEyebrow}
              </div>

              <div className="absolute bottom-5 left-5 max-w-sm rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-[#fff1df]/82 backdrop-blur-md">
                {mediaCaption}
              </div>

              <div className="absolute bottom-5 right-5 z-10">
                {!isVideoPlaying ? (
                  <button
                    type="button"
                    onClick={handlePlayVideo}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/16 text-white shadow-lg backdrop-blur-md transition hover:bg-white/24"
                    aria-label="Play preview video"
                  >
                    <Play className="ml-1 h-6 w-6 fill-white" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={isVideoPaused ? handleResumeVideo : handlePauseVideo}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/16 text-white shadow-lg backdrop-blur-md transition hover:bg-white/24"
                    aria-label={isVideoPaused ? "Resume preview video" : "Pause preview video"}
                  >
                    {isVideoPaused ? (
                      <Play className="ml-1 h-6 w-6 fill-white" />
                    ) : (
                      <Pause className="h-6 w-6 fill-white" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
