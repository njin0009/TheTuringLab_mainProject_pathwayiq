"use client";

import { useState } from "react";
import Image from "next/image";

const NAV_ITEMS = [
  { label: "Home", idx: 0 },
  { label: "Quiz", idx: 1 },
  { label: "Explore", idx: 2 },
  { label: "Compare", idx: 3 },
  { label: "Report", idx: 4 },
];

interface BottomNavProps {
  activeIdx?: number;
  onNavigate?: (idx: number) => void;
  reportCompanion?: {
    label: string;
    illustrationSrc: string;
    careerTitle: string;
  };
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

export function BottomNav({ activeIdx = 0, onNavigate, reportCompanion }: BottomNavProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Ask me about this report, next steps, or how this style fits your career options.",
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const showReportCompanion = activeIdx === 4 && reportCompanion;

  async function sendMessage() {
    const trimmed = chatInput.trim();
    if (!trimmed || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setChatInput("");
    setIsSending(true);

    try {
      const endpoint = process.env.NEXT_PUBLIC_GEMINI_CHAT_ENDPOINT;
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            style: reportCompanion?.label,
            careerTitle: reportCompanion?.careerTitle,
            messages: nextMessages,
          }),
        });

        const data = (await response.json()) as { reply?: string; error?: string };

        if (!response.ok) {
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: `Error: ${data.error ?? response.statusText}`,
            },
          ]);
          return;
        }

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: data.reply ?? "I received that. The Gemini endpoint did not return a reply yet.",
          },
        ]);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Gemini is ready to connect. Once the backend endpoint is configured, I can answer as your ${reportCompanion?.label ?? "style"} guide for ${reportCompanion?.careerTitle ?? "this report"}.`,
        },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Connection failed: ${err instanceof Error ? err.message : "unknown error"}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[200] flex h-[4.6rem] items-end justify-center gap-2.5 border-t border-white/8 bg-[rgba(4,8,18,0.92)] px-4 pb-2">
      {showReportCompanion ? (
        <div className="absolute bottom-[4.9rem] right-5 z-[230] flex flex-col items-end gap-3">
          {chatOpen ? (
            <div className="w-[min(22rem,calc(100vw-2rem))] rounded-[24px] border border-slate-200 bg-white p-4 text-slate-950 shadow-[0_22px_64px_rgba(15,23,42,0.28)]">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                  <Image
                    src={reportCompanion.illustrationSrc}
                    alt=""
                    width={44}
                    height={44}
                    className="h-10 w-10 object-contain"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold">{reportCompanion.label} guide</div>
                  <div className="text-xs text-slate-500">Gemini-ready chatbot</div>
                </div>
              </div>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`rounded-2xl px-3 py-2 text-sm leading-6 ${
                      message.role === "user"
                        ? "ml-8 bg-slate-950 text-white"
                        : "mr-8 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {message.content}
                  </div>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage();
                }}
              >
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ask about my report..."
                  className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-950"
                />
                <button
                  type="submit"
                  disabled={isSending}
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isSending ? "..." : "Send"}
                </button>
              </form>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setChatOpen((current) => !current)}
            className="group flex items-center gap-3 rounded-full border border-white/14 bg-white px-3 py-2 text-slate-950 shadow-[0_18px_48px_rgba(15,23,42,0.28)] transition hover:-translate-y-1"
            aria-label={`Chat with your ${reportCompanion.label} guide`}
          >
            <span className="hidden pl-2 text-sm font-semibold md:inline">
              {reportCompanion.label} guide
            </span>
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
              <Image
                src={reportCompanion.illustrationSrc}
                alt=""
                width={58}
                height={58}
                className="h-12 w-12 object-contain transition group-hover:scale-105"
              />
            </span>
          </button>
        </div>
      ) : null}

      {NAV_ITEMS.map(({ label, idx }) => {
        const isActive = idx === activeIdx;

        return (
          <button
            key={idx}
            data-nav-item={idx}
            type="button"
            onClick={() => onNavigate?.(idx)}
            className={`relative inline-flex h-10 min-w-[8.4rem] items-center justify-center rounded-full border px-5 text-[15px] font-semibold tracking-[0.01em] transition-all duration-300 ${
              isActive
                ? "border-cyan-100/75 bg-[linear-gradient(180deg,rgba(56,189,248,0.34),rgba(15,23,42,0.96))] text-white shadow-[0_10px_24px_rgba(34,211,238,0.2)] ring-1 ring-cyan-300/35"
                : "border-white/10 bg-[rgba(2,6,23,0.68)] text-slate-200 hover:border-white/16 hover:bg-[rgba(8,15,32,0.84)] hover:text-white"
            }`}
          >
            <span className={`relative z-10 ${isActive ? "drop-shadow-[0_1px_8px_rgba(255,255,255,0.16)]" : ""}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
