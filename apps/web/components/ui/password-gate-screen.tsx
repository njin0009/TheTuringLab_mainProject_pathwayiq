"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PathwayWalker,
  type PathwayWalkerVariant,
} from "@/components/pathway/pathway-walker";
import { Balloons } from "@/components/ui/balloons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const walkerRef = useRef<HTMLDivElement>(null);
  const balloonsRef = useRef<{ launchAnimation: () => void } | null>(null);
  const unlockTimerRef = useRef<number | null>(null);
  const walkerIdleTimerRef = useRef<number | null>(null);

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
    const centerWalker = () => {
      const walker = walkerRef.current;
      if (!walker) {
        return;
      }

      const centered = Math.max(96, Math.min(window.innerWidth - 96, window.innerWidth / 2));
      walker.style.left = `${centered}px`;
      walker.style.bottom = "1.5rem";
      walker.classList.add("walker-idle");
      walker.classList.remove("walker-walking");
    };

    centerWalker();
    window.addEventListener("resize", centerWalker);

    return () => {
      window.removeEventListener("resize", centerWalker);

      if (unlockTimerRef.current !== null) {
        window.clearTimeout(unlockTimerRef.current);
      }

      if (walkerIdleTimerRef.current !== null) {
        window.clearTimeout(walkerIdleTimerRef.current);
      }
    };
  }, []);

  const syncWalkerPosition = (clientX: number, moving: boolean) => {
    const walker = walkerRef.current;
    if (!walker) {
      return;
    }

    const clamped = Math.max(96, Math.min(window.innerWidth - 96, clientX));
    walker.style.left = `${clamped}px`;
    walker.style.bottom = "1.5rem";
    walker.classList.toggle("walker-walking", moving);
    walker.classList.toggle("walker-idle", !moving);
  };

  const settleWalker = () => {
    if (walkerIdleTimerRef.current !== null) {
      window.clearTimeout(walkerIdleTimerRef.current);
    }

    walkerIdleTimerRef.current = window.setTimeout(() => {
      syncWalkerPosition(window.innerWidth / 2, false);
    }, 220);
  };

  return (
    <section
      className="relative h-screen w-screen overflow-hidden bg-[#010308] text-white"
      onPointerMove={(event) => {
        syncWalkerPosition(event.clientX, true);

        if (walkerIdleTimerRef.current !== null) {
          window.clearTimeout(walkerIdleTimerRef.current);
        }
      }}
      onPointerLeave={settleWalker}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.22),transparent_20%),radial-gradient(circle_at_78%_22%,rgba(249,115,22,0.2),transparent_24%),radial-gradient(circle_at_50%_65%,rgba(14,165,233,0.08),transparent_28%),linear-gradient(180deg,#02050b_0%,#050b14_48%,#02040a_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(1,3,8,0.12),rgba(1,3,8,0.72)_56%,rgba(1,3,8,0.94))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_60%)]" />
      <Balloons
        ref={balloonsRef}
        type="default"
        className="pointer-events-none absolute inset-0 z-30"
      />

      <div className="relative z-20 flex h-full items-center justify-center px-6 py-12">
        <Card
          className={`w-full max-w-xl border-white/10 bg-[#040b15]/82 shadow-[0_32px_100px_rgba(0,0,0,0.42)] transition-all duration-700 ${
            isUnlocking
              ? "scale-[0.985] border-emerald-300/25 bg-[#051019]/88 shadow-[0_28px_90px_rgba(16,185,129,0.14)]"
              : ""
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
              {error ? (
                <LockKeyhole className="h-6 w-6" />
              ) : (
                <ShieldCheck className="h-6 w-6" />
              )}
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
                  error
                    ? "text-orange-200"
                    : isUnlocking
                      ? "text-emerald-100"
                      : "text-white/72"
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
