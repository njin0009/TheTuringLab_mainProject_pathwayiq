import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl p-8 text-left shadow-sm transition-shadow duration-300 hover:shadow-lg",
  {
    variants: {
      gradient: {
        orange: "bg-gradient-to-br from-orange-100 to-amber-200/60",
        gray: "bg-gradient-to-br from-slate-100 to-slate-200/60",
        purple: "bg-gradient-to-br from-purple-100 to-indigo-200/60",
        green: "bg-gradient-to-br from-emerald-100 to-teal-200/60",
      },
    },
    defaultVariants: {
      gradient: "gray",
    },
  },
);

export interface GradientCardProps
  extends VariantProps<typeof cardVariants> {
  className?: string;
  badgeText: string;
  badgeColor: string;
  title: string;
  description: string;
  ctaText: string;
  imageUrl: string;
  onClick?: () => void;
  disabled?: boolean;
}

const GradientCard = React.forwardRef<HTMLButtonElement, GradientCardProps>(
  (
    { className, gradient, badgeText, badgeColor, title, description, ctaText, imageUrl, ...props },
    ref,
  ) => {
    const cardAnimation = {
      rest: { scale: 1, y: 0 },
      hover: { scale: 1.02, y: -4 },
    };

    const imageAnimation = {
      rest: { scale: 1, rotate: 0 },
      hover: { scale: 1.08, rotate: 3 },
    };

    return (
      <motion.button
        ref={ref}
        type="button"
        variants={cardAnimation}
        initial="rest"
        whileHover="hover"
        animate="rest"
        className="h-full w-full"
        {...props}
      >
        <div className={cn(cardVariants({ gradient }), className)}>
          <motion.img
            src={imageUrl}
            alt={`${title} graphic`}
            variants={imageAnimation}
            transition={{ type: "spring", stiffness: 360, damping: 18 }}
            className="pointer-events-none absolute -bottom-8 -right-8 w-40 opacity-85"
          />

          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-sm font-medium text-slate-700 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: badgeColor }} />
              {badgeText}
            </div>

            <div className="flex-grow">
              <h3 className="mb-2 max-w-[16rem] text-2xl font-bold text-slate-900">{title}</h3>
              <p className="max-w-sm text-sm leading-7 text-slate-700">{description}</p>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              {ctaText}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </motion.button>
    );
  },
);

GradientCard.displayName = "GradientCard";

export { GradientCard, cardVariants };
