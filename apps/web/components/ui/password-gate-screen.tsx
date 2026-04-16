"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PathwayWalker,
  type PathwayWalkerVariant,
} from "@/components/pathway/pathway-walker";
import { Balloons } from "@/components/ui/balloons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FireBall } from "@/components/ui/fire-ball";
import { InteractiveRobotSpline } from "@/components/ui/interactive-3d-robot";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/interfaces-input-otp";

interface PasswordGateScreenProps {
  onUnlock: () => void;
}

const ACCESS_CODE = "666666";
const ROBOT_SCENE_URL = "https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode";
const UNLOCK_TRANSITION_MS = 1080;
const GATE_WALKER: PathwayWalkerVariant = {
  src: "/undraw-scooter.svg",
  width: 800,
  height: 758,
  className: "h-[118px] w-auto drop-shadow-[0_16px_28px_rgba(0,0,0,0.26)]",
};

export default function PasswordGateScreen({
  onUnlock,
}: PasswordGateScreenProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const balloonsRef = useRef<{ launchAnimation: () => void } | null>(null);
  const frameRef = useRef<number | null>(null);
  const unlockTimerRef = useRef<number | null>(null);
  const currentXRef = useRef(0);
  const targetXRef = useRef(0);

  const helperText = useMemo(() => {
    if (error) {
      return "Code not recognised. Try again.";
    }

    if (isUnlocking) {
      return "Access granted. Launching your PathwayIQ experience...";
    }

    if (value.length === ACCESS_CODE.length) {
      return "Unlocking PathwayIQ...";
    }

    return "Enter the 6-digit access code to continue.";
  }, [error, isUnlocking, value.length]);

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const walker = walkerRef.current;
    const section = sectionRef.current;
    if (!walker || !section) {
      return;
    }

    const clampX = (value: number) =>
      Math.max(96, Math.min(window.innerWidth - 96, value));

    const resetTarget = () => {
      const centered = clampX(window.innerWidth / 2);
      currentXRef.current = centered;
      targetXRef.current = centered;
      walker.style.left = `${centered}px`;
      walker.style.bottom = "1.5rem";
      walker.classList.add("walker-idle");
      walker.classList.remove("walker-walking");
    };

    resetTarget();

    const animate = () => {
      const current = currentXRef.current;
      const target = targetXRef.current;
      const next = current + (target - current) * 0.12;
      currentXRef.current = next;
      walker.style.left = `${next}px`;
      walker.style.bottom = "1.5rem";

      const moving = Math.abs(target - next) > 1;
      walker.classList.toggle("walker-walking", moving);
      walker.classList.toggle("walker-idle", !moving);

      frameRef.current = window.requestAnimationFrame(animate);
    };

    const handlePointerMove = (event: PointerEvent) => {
      targetXRef.current = clampX(event.clientX);
    };

    const handlePointerLeave = () => {
      targetXRef.current = clampX(window.innerWidth / 2);
    };

    const handleResize = () => {
      targetXRef.current = clampX(targetXRef.current || window.innerWidth / 2);
      currentXRef.current = clampX(currentXRef.current || window.innerWidth / 2);
    };

    section.addEventListener("pointermove", handlePointerMove);
    section.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("resize", handleResize);
    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      section.removeEventListener("pointermove", handlePointerMove);
      section.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", handleResize);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-screen overflow-hidden bg-[#010308] text-white"
    >
      <InteractiveRobotSpline scene={ROBOT_SCENE_URL} className="absolute inset-0 z-0" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.18),transparent_20%),radial-gradient(circle_at_80%_22%,rgba(249,115,22,0.18),transparent_24%),linear-gradient(180deg,rgba(1,3,8,0.58),rgba(1,3,8,0.84)_55%,rgba(1,3,8,0.96))]" />
      <FireBall
        className="pointer-events-none z-[12] opacity-90"
        background="transparent"
        colors={["#22d3ee", "#fb923c", "#38bdf8"]}
        ballColor="#f8fafc"
        particleCount={16}
        followStrength={0.12}
        blur={2.5}
        blobRadius={6}
        useXorComposite={false}
      />
      <Balloons ref={balloonsRef} type="default" className="pointer-events-none absolute inset-0 z-30" />

      <div className="relative z-20 flex h-full items-center justify-center px-6 py-12">
        <Card
          className={`w-full max-w-xl border-white/10 bg-[#040b15]/72 shadow-[0_32px_100px_rgba(0,0,0,0.48)] backdrop-blur-2xl transition-all duration-700 ${
            isUnlocking ? "scale-[0.985] border-emerald-300/25 bg-[#051019]/84 shadow-[0_32px_120px_rgba(16,185,129,0.18)]" : ""
          }`}
        >
          <CardHeader className="items-center text-center">
            <div
              className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border text-cyan-200 transition-all duration-500 ${
                isUnlocking
                  ? "border-emerald-300/35 bg-emerald-400/16 text-emerald-100"
                  : "border-cyan-300/24 bg-cyan-400/10"
              }`}
            >
              {error ? <LockKeyhole className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <div
              className={`text-xs font-semibold uppercase tracking-[0.34em] transition-colors duration-500 ${
                isUnlocking ? "text-emerald-200" : "text-cyan-300"
              }`}
            >
              {isUnlocking ? "Access Granted" : "Secure Entry"}
            </div>
            <CardTitle className="mt-3 text-3xl text-white md:text-4xl">
              {isUnlocking ? "Welcome to PathwayIQ" : "Enter the access code"}
            </CardTitle>
            <CardDescription className="max-w-md text-base leading-7 text-white/68">
              {isUnlocking
                ? "Hold on for a moment while we transition you into the main experience."
                : "This page now sits before Home. Enter the 6-digit code to continue into PathwayIQ."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div
              className={`flex justify-center transition-all duration-500 ${
                isUnlocking ? "scale-95 opacity-70" : ""
              }`}
              data-prevent-walker="true"
            >
              <InputOTP
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                value={value}
                disabled={isUnlocking}
                onChange={(nextValue) => {
                  if (isUnlocking) {
                    return;
                  }

                  setValue(nextValue);
                  if (error) {
                    setError(false);
                  }

                  if (nextValue.length < ACCESS_CODE.length) {
                    return;
                  }

                  if (nextValue === ACCESS_CODE) {
                    setIsUnlocking(true);
                    balloonsRef.current?.launchAnimation();
                    unlockTimerRef.current = window.setTimeout(() => {
                      onUnlock();
                    }, UNLOCK_TRANSITION_MS);
                    return;
                  }

                  setError(true);
                  window.setTimeout(() => {
                    setValue("");
                    setError(false);
                  }, 900);
                }}
                containerClassName="gap-3 md:gap-4"
                autoFocus
              >
                <InputOTPGroup className="gap-3">
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup className="gap-3">
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="rounded-2xl border border-white/8 bg-black/18 px-4 py-3 text-center">
              <div
                className={`text-sm font-medium ${
                  error ? "text-orange-200" : isUnlocking ? "text-emerald-100" : "text-white/72"
                }`}
              >
                {helperText}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <PathwayWalker ref={walkerRef} variant={GATE_WALKER} />
    </section>
  );
}
