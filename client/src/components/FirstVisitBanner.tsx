// FirstVisitBanner — appears once per `visitKey`, then dismisses permanently.
// Lightweight, non-blocking, always skippable.

import { X } from "lucide-react";
import { type ReactNode } from "react";
import { useFirstVisit } from "@/lib/useFirstVisit";
import { cn } from "@/lib/utils";

interface FirstVisitBannerProps {
  visitKey: string;
  icon?: ReactNode;
  title: string;
  body: string;
  className?: string;
}

export function FirstVisitBanner({ visitKey, icon, title, body, className }: FirstVisitBannerProps) {
  const { isFirst, dismiss } = useFirstVisit(visitKey);
  if (!isFirst) return null;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/6 px-4 py-4",
        className,
      )}
    >
      {icon && (
        <div className="mt-0.5 shrink-0 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-black text-foreground leading-snug">{title}</p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{body}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
