"use client";

import { useState } from "react";
import {
  QUIZ_MODES,
  buildQuizResult,
  getQuestionsForMode,
  type QuizAnswerMap,
  type QuizModeId,
} from "@/lib/quiz-data";

export type QuizPhase = "mode" | "question" | "result";

export function useQuizState() {
  const [mode, setMode] = useState<QuizModeId | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswerMap>({});

  const questions = mode ? getQuestionsForMode(mode) : [];
  const phase: QuizPhase = !mode
    ? "mode"
    : questionIndex >= questions.length
      ? "result"
      : "question";
  const currentQuestion = phase === "question" ? questions[questionIndex] : null;
  const selectedOptionId = currentQuestion ? answers[currentQuestion.id] ?? null : null;
  const result = phase === "result" && mode ? buildQuizResult(mode, answers) : null;
  const questionNumber = currentQuestion ? questionIndex + 1 : 0;
  const progressPercent =
    phase === "result"
      ? 100
      : questions.length > 0
        ? Math.round((questionNumber / questions.length) * 100)
        : 0;

  function startMode(nextMode: QuizModeId) {
    setMode(nextMode);
    setAnswers({});
    setQuestionIndex(0);
  }

  function chooseOption(optionId: string) {
    if (!currentQuestion) {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: optionId,
    }));
  }

  function nextQuestion() {
    if (!currentQuestion || !selectedOptionId) {
      return;
    }

    setQuestionIndex((current) => Math.min(current + 1, questions.length));
  }

  function previousQuestion() {
    if (phase !== "question") {
      return;
    }

    setQuestionIndex((current) => Math.max(current - 1, 0));
  }

  function restartMode() {
    if (!mode) {
      return;
    }

    setAnswers({});
    setQuestionIndex(0);
  }

  function resetQuiz() {
    setMode(null);
    setAnswers({});
    setQuestionIndex(0);
  }

  return {
    mode,
    modes: QUIZ_MODES,
    phase,
    questions,
    answers,
    currentQuestion,
    currentQuestionIndex: questionIndex,
    questionNumber,
    selectedOptionId,
    progressPercent,
    hasAnsweredCurrent: Boolean(selectedOptionId),
    canGoBack: questionIndex > 0,
    result,
    startMode,
    switchMode: startMode,
    chooseOption,
    nextQuestion,
    previousQuestion,
    restartMode,
    resetQuiz,
  };
}
