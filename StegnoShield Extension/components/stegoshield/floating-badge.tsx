"use client";

import { cn } from "@/lib/utils";

type FloatingBadgeProps = {
  onClick?: () => void;
  className?: string;
  "aria-controls"?: string;
  title?: string;
};

export function FloatingBadge({
  onClick,
  className,
  title = "StegoShield",
  ...props
}: FloatingBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open StegoShield panel"
      title={title}
      className={cn(
        "group inline-flex h-10 w-10 items-center justify-center rounded-full",
        "bg-[#3B82F6] text-white shadow-lg ring-1 ring-black/5",
        "transition-transform duration-150 ease-out hover:scale-105 hover:shadow-xl active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#3B82F6]",
        "isolate-contain-layout-style-paint",
        "will-change-transform",
        "transform-gpu",
        "filter-none",
        "backdrop-filter-none",
        "mix-blend-normal",
        className
      )}
      style={{
        isolation: "isolate",
        contain: "layout style paint",
        willChange: "transform",
        transform: "translateZ(0)",
        filter: "none",
        backdropFilter: "none",
        mixBlendMode: "normal",
      }}
      {...props}
    >
      <span aria-hidden className="text-sm font-semibold">
        S
      </span>
      <span className="sr-only">StegoShield</span>
    </button>
  );
}
