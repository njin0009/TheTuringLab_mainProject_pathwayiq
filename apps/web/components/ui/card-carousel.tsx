"use client";

import React from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { Autoplay, EffectCoverflow, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";
import "swiper/css/navigation";

import type { StyleFigure } from "@/lib/style-figures";

interface CarouselProps {
  figures: StyleFigure[];
  autoplayDelay?: number;
  showPagination?: boolean;
  showNavigation?: boolean;
}

export const CardCarousel: React.FC<CarouselProps> = ({
  figures,
  autoplayDelay = 2600,
  showPagination = true,
  showNavigation = true,
}) => {
  const fallbackPortrait = (name: string) =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="525" viewBox="0 0 420 525"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f8b8d"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="420" height="525" fill="url(#g)"/><circle cx="210" cy="190" r="76" fill="rgba(255,255,255,.22)"/><rect x="96" y="292" width="228" height="42" rx="21" fill="rgba(255,255,255,.16)"/><text x="210" y="382" fill="white" font-family="Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle">${name.replace(/&/g, "&amp;")}</text></svg>`,
    )}`;

  const css = `
  .style-figure-swiper {
    width: 100%;
    padding: 8px 0 46px;
  }

  .style-figure-swiper .swiper-slide {
    background-position: center;
    background-size: cover;
    width: 245px;
  }

  .style-figure-swiper .swiper-pagination-bullet {
    background: rgba(255,255,255,.76);
  }

  .style-figure-swiper .swiper-button-prev,
  .style-figure-swiper .swiper-button-next {
    color: rgba(255,255,255,.86);
    transform: scale(.68);
  }

  .style-figure-swiper .swiper-3d .swiper-slide-shadow-left,
  .style-figure-swiper .swiper-3d .swiper-slide-shadow-right {
    background-image: none;
    background: none;
  }
  `;

  return (
    <section className="w-full space-y-4">
      <style>{css}</style>
      <div className="mx-auto w-full rounded-[24px] border border-white/12 bg-white/10 p-2 shadow-sm md:rounded-t-[36px]">
        <div className="relative mx-auto flex w-full flex-col rounded-[24px] border border-white/10 bg-slate-950/18 p-2 shadow-sm md:rounded-b-[20px] md:rounded-t-[32px]">
          <div className="pb-1 pl-4 pt-4">
            <h3 className="text-2xl font-bold tracking-tight text-white">
              Icons and role models
            </h3>
            <p className="mt-1 text-sm text-white/68">
              Tap a card to open the Wikipedia profile.
            </p>
          </div>

          <div className="flex w-full items-center justify-center">
            <div className="w-full">
              <Swiper
                className="style-figure-swiper"
                spaceBetween={42}
                autoplay={{
                  delay: autoplayDelay,
                  disableOnInteraction: false,
                }}
                effect="coverflow"
                grabCursor
                centeredSlides
                loop={figures.length > 2}
                slidesPerView="auto"
                coverflowEffect={{
                  rotate: 0,
                  stretch: 0,
                  depth: 105,
                  modifier: 2.35,
                }}
                pagination={showPagination}
                navigation={
                  showNavigation
                    ? {
                        nextEl: ".swiper-button-next",
                        prevEl: ".swiper-button-prev",
                      }
                    : undefined
                }
                modules={[EffectCoverflow, Autoplay, Pagination, Navigation]}
              >
                {figures.map((figure) => (
                  <SwiperSlide key={figure.name}>
                    <a
                      href={figure.wikiUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group block overflow-hidden rounded-3xl border border-white/12 bg-white text-slate-950 shadow-[0_18px_55px_rgba(0,0,0,0.22)] transition hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(0,0,0,0.3)]"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden bg-slate-200">
                        <Image
                          src={figure.imageUrl}
                          width={420}
                          height={525}
                          unoptimized
                          loading="eager"
                          onError={(event) => {
                            event.currentTarget.src = fallbackPortrait(figure.name);
                          }}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          alt={`${figure.name} portrait`}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 to-transparent p-4 text-white">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-lg font-semibold leading-tight">
                                {figure.name}
                              </div>
                              <div className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-white/72">
                                {figure.field}
                              </div>
                            </div>
                            <ExternalLink className="h-4 w-4 shrink-0 text-white/72" />
                          </div>
                        </div>
                      </div>
                      <p className="min-h-[98px] p-4 text-sm leading-6 text-slate-600">
                        {figure.lesson}
                      </p>
                    </a>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
