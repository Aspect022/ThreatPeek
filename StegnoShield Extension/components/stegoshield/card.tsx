"use client"

import type * as React from "react"
import { cn } from "@/lib/utils"

export type CardProps = React.HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: CardProps) {
  return <div className={cn("rounded-2xl shadow bg-white p-4", className)} {...props} />
}
