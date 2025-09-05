"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary"
  size?: "sm" | "md"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-xl font-medium transition focus:outline-none focus-visible:ring-2"
    const sizes = {
      sm: "text-sm px-3 py-1.5",
      md: "text-base px-4 py-2",
    }[size]
    const variants = {
      primary:
        "bg-[#3B82F6] text-white hover:shadow focus-visible:ring-[#3B82F6] disabled:opacity-60 disabled:pointer-events-none",
      secondary:
        "bg-white text-[#6B7280] border border-[#6B7280] hover:shadow focus-visible:ring-[#3B82F6] disabled:opacity-60 disabled:pointer-events-none",
    }[variant]

    return <button ref={ref} className={cn(base, sizes, variants, className)} disabled={disabled} {...props} />
  },
)
Button.displayName = "Button"
