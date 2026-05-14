"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { gsap } from "gsap";

interface LoopingWordsProps {
  words: string[];
  accentClassName?: string;
}

export const LoopingWords: React.FC<LoopingWordsProps> = ({
  words,
  accentClassName = "text-cyan-200",
}) => {
  const wordListRef = useRef<HTMLUListElement>(null);
  const edgeElementRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const currentIndexRef = useRef(0);

  const displayWords = words.length > 0 ? words : ["clear strengths"];
  const totalWords = displayWords.length;
  const wordHeight = 100 / totalWords;

  const updateEdgeWidth = useCallback(() => {
    const wordList = wordListRef.current;
    const edgeElement = edgeElementRef.current;

    if (!wordList || !edgeElement || wordList.children.length === 0) {
      return;
    }

    const centerWordIndex = (currentIndexRef.current + 1) % totalWords;
    const centerWord = wordList.children[centerWordIndex] as HTMLLIElement | undefined;

    if (!centerWord) {
      return;
    }

    const centerWordWidth = centerWord.getBoundingClientRect().width;
    const listWidth = wordList.getBoundingClientRect().width || centerWordWidth;
    const percentageWidth = Math.max(24, (centerWordWidth / listWidth) * 100);

    gsap.to(edgeElement, {
      width: `${percentageWidth}%`,
      duration: 0.45,
      ease: "expo.out",
    });
  }, [totalWords]);

  const moveWords = useCallback(() => {
    const wordList = wordListRef.current;
    if (!wordList) {
      return;
    }

    currentIndexRef.current += 1;

    gsap.to(wordList, {
      yPercent: -wordHeight * currentIndexRef.current,
      duration: 1,
      ease: "elastic.out(1, 0.82)",
      onStart: updateEdgeWidth,
      onComplete: () => {
        if (currentIndexRef.current >= totalWords - 2) {
          wordList.appendChild(wordList.children[0]);
          currentIndexRef.current -= 1;
          gsap.set(wordList, { yPercent: -wordHeight * currentIndexRef.current });
        }
      },
    });
  }, [totalWords, updateEdgeWidth, wordHeight]);

  useEffect(() => {
    currentIndexRef.current = 0;
    updateEdgeWidth();

    timelineRef.current?.kill();
    timelineRef.current = gsap.timeline({ repeat: -1, delay: 0.8 });
    timelineRef.current.call(moveWords).to({}, { duration: 1.7 });

    return () => {
      timelineRef.current?.kill();
    };
  }, [displayWords, moveWords, updateEdgeWidth]);

  return (
    <div className="relative w-full max-w-[360px]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[#121c34] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[#121c34] to-transparent" />
      <div className="h-[88px] overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] px-6">
        <ul ref={wordListRef} className="space-y-0">
          {displayWords.map((word, index) => (
            <li
              key={`${word}-${index}`}
              className="flex h-[88px] items-center justify-center text-center"
            >
              <p
                className={[
                  "text-xl font-semibold tracking-[0.02em] md:text-2xl",
                  accentClassName,
                ].join(" ")}
              >
                {word}
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div
        ref={edgeElementRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[88px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-white/14"
        style={{ width: "54%" }}
      />
    </div>
  );
};
