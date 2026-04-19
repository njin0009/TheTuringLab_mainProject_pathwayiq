import React from "react";

interface GradientCardShowcaseItem {
  id: string;
  title: string;
  description: string;
  eyebrow: string;
  ctaLabel: string;
  gradientFrom: string;
  gradientTo: string;
  onSelect: () => void;
}

interface GradientCardShowcaseProps {
  items: GradientCardShowcaseItem[];
  className?: string;
}

export default function GradientCardShowcase({
  items,
  className = "",
}: GradientCardShowcaseProps) {
  return (
    <>
      <div className={`flex flex-wrap items-start justify-center gap-x-6 gap-y-8 py-8 ${className}`}>
        {items.map(({ id, title, description, eyebrow, ctaLabel, gradientFrom, gradientTo, onSelect }) => (
          <div
            key={id}
            className="gradient-showcase-card group relative h-[360px] w-full max-w-[320px] transition-all duration-500"
          >
            <span
              className="absolute left-[52px] top-0 h-full w-1/2 rounded-[22px] transition-all duration-500 group-hover:left-[20px] group-hover:w-[calc(100%-80px)] group-hover:skew-x-0"
              style={{
                background: `linear-gradient(315deg, ${gradientFrom}, ${gradientTo})`,
                transform: "skewX(15deg)",
              }}
            />
            <span
              className="absolute left-[52px] top-0 h-full w-1/2 rounded-[22px] blur-[30px] transition-all duration-500 group-hover:left-[20px] group-hover:w-[calc(100%-80px)] group-hover:skew-x-0"
              style={{
                background: `linear-gradient(315deg, ${gradientFrom}, ${gradientTo})`,
                transform: "skewX(15deg)",
              }}
            />

            <span className="pointer-events-none absolute inset-0 z-10">
              <span className="gradient-orb gradient-orb-top absolute left-0 top-0 h-0 w-0 rounded-[20px] opacity-0 backdrop-blur-[14px] transition-all duration-500 group-hover:left-[44px] group-hover:top-[-34px] group-hover:h-[94px] group-hover:w-[94px] group-hover:opacity-100" />
              <span className="gradient-orb gradient-orb-bottom absolute bottom-0 right-0 h-0 w-0 rounded-[20px] opacity-0 backdrop-blur-[14px] transition-all duration-500 group-hover:bottom-[-34px] group-hover:right-[38px] group-hover:h-[94px] group-hover:w-[94px] group-hover:opacity-100" />
            </span>

            <div className="relative left-0 z-20 flex h-full flex-col justify-between rounded-[24px] border border-white/10 bg-[rgba(7,16,24,0.52)] px-7 py-7 text-white shadow-[0_22px_60px_rgba(0,0,0,0.28)] backdrop-blur-[14px] transition-all duration-500 group-hover:left-[-18px] group-hover:px-8 group-hover:py-8">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/60">
                  {eyebrow}
                </div>
                <h3 className="mt-4 text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-white/75">
                  {description}
                </p>
              </div>

              <button
                type="button"
                onClick={onSelect}
                className="inline-flex w-fit items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-[#ffcf4d] hover:shadow-[0_12px_24px_rgba(255,207,77,0.18)]"
              >
                {ctaLabel}
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes gradient-showcase-blob {
          0%, 100% { transform: translateY(10px); }
          50% { transform: translate(-10px, -12px); }
        }

        .gradient-orb {
          background: rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
          animation: gradient-showcase-blob 2.8s ease-in-out infinite;
        }

        .gradient-orb-bottom {
          animation-delay: -1.1s;
        }

        @media (max-width: 767px) {
          .gradient-showcase-card {
            height: 320px;
          }
        }
      `}</style>
    </>
  );
}
