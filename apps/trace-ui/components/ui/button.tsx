import * as React from "react";
import { cn } from "@/lib/utils";

const baseButtonClasses =
  "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

const variantClasses = {
  default: "bg-brand-500 text-white hover:bg-brand-400 shadow-brand transition-colors",
  outline: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  subtle: "bg-slate-100 text-slate-800 hover:bg-slate-200",
  ghost: "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
} as const;

type Variant = keyof typeof variantClasses;

export const buttonClass = (variant: Variant = "default", className?: string) =>
  cn(baseButtonClasses, variantClasses[variant], className);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <button ref={ref} className={buttonClass(variant, className)} {...props} />
  )
);
Button.displayName = "Button";
