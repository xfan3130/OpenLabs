import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * A styled native <select>. Native selects are fully keyboard accessible
 * and behave well on Chromebooks and tablets, which matters in classrooms.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full", className)}>
      <select
        data-slot="native-select"
        className="h-8 w-full cursor-pointer appearance-none rounded-md border border-input bg-card pl-2.5 pr-8 text-[13px] text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
