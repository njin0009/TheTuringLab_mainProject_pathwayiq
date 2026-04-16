import * as React from "react";
import { cn } from "@/lib/utils";
import { balloons, textBalloons } from "balloons-js";

export interface BalloonsProps {
  type?: "default" | "text";
  text?: string;
  fontSize?: number;
  color?: string;
  className?: string;
  onLaunch?: () => void;
}

export interface BalloonsHandle {
  launchAnimation: () => void;
}

export const Balloons = React.forwardRef<BalloonsHandle, BalloonsProps>(
  (
    {
      type = "default",
      text,
      fontSize = 120,
      color = "#000000",
      className,
      onLaunch,
    },
    ref,
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null);

    const launchAnimation = React.useCallback(() => {
      if (type === "default") {
        balloons();
      } else if (type === "text" && text) {
        textBalloons([
          {
            text,
            fontSize,
            color,
          },
        ]);
      }

      onLaunch?.();
    }, [color, fontSize, onLaunch, text, type]);

    React.useImperativeHandle(
      ref,
      () => ({
        launchAnimation,
      }),
      [launchAnimation],
    );

    return <div ref={containerRef} className={cn("balloons-container", className)} />;
  },
);

Balloons.displayName = "Balloons";
