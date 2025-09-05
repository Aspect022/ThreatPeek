"use client"
import { cn } from "@/lib/utils"

export type YesNoBadgeProps = {
  value: boolean
  yesLabel?: string
  noLabel?: string
  className?: string
}

export function YesNoBadge({ value, yesLabel = "Yes", noLabel = "No", className }: YesNoBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        value ? "bg-[#10B981] text-white" : "bg-[#EF4444] text-white",
        className,
      )}
      aria-label={value ? yesLabel : noLabel}
      role="status"
    >
      {value ? yesLabel : noLabel}
    </span>
  )
}
