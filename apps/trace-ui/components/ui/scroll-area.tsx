import * as React from "react";
import { cn } from "@/lib/utils";

export type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement>;

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative overflow-hidden rounded-2xl border border-slate-100", className)}
      {...props}
    >
      <div className="max-h-[24rem] overflow-y-auto p-4">{children}</div>
    </div>
  )
);
ScrollArea.displayName = "ScrollArea";
