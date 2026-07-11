"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 min-h-[42px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" ? "bg-primary text-white hover:bg-primary-hover" : "",
        variant === "secondary" ? "bg-[#dde6ed] text-[#17242d] hover:bg-[#c8d6e0]" : "",
        variant === "ghost" ? "bg-transparent text-[#42515c] hover:bg-gray-100" : "",
        variant === "danger" ? "bg-[#9b2d24] text-white hover:bg-[#7a231c]" : "",
        className
      )}
      {...props}
    />
  );
}
