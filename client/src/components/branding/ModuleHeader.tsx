/**
 * ModuleHeader — cabecera estándar para todos los módulos de U CORE.
 * Replica el patrón visual de CoachHome (U Scout):
 *   logo centrado + tagline + settings button
 *
 * Uso:
 *   <ModuleHeader module="core"     tagline="Operations Platform" />
 *   <ModuleHeader module="scout"    tagline="Scouting Platform" />
 *   <ModuleHeader module="schedule" tagline="Training & Calendar" />
 *   <ModuleHeader module="wellness" tagline="Team Wellbeing" />
 */

import { useLocation } from "wouter";
import { Settings } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useCapabilities } from "@/lib/capabilities";
import { cn } from "@/lib/utils";

// ─── U Mark SVG inline (solo el símbolo, sin wordmark) ───────────────────────
// viewBox recortado a la zona del símbolo U (excluye las letras SCOUT debajo)
const U_MARK_VIEWBOX = "260 300 510 210";
const U_MARK_PATH = "M288.289 318.118C289.221 325.07 294.736 334.799 301.552 341.515C312.636 352.436 329.068 359.222 352.865 362.704C362.461 364.109 373.085 364.43 413.5 364.539C444.206 364.622 463.62 365.057 465.5 365.703C482.094 371.409 490.715 381.404 492.955 397.534C494.205 406.54 494.432 450.968 493.234 452.166C492.735 452.665 487.64 452.945 481.913 452.787L471.5 452.5L470.904 426.5C470.134 392.886 469.331 390.594 457.072 387.048C451.513 385.44 445.875 385.061 420.5 384.59C373.973 383.726 353.073 381.434 332.5 374.939C318.536 370.53 309.727 365.665 301.395 357.761C292.764 349.574 288.302 341.702 286.54 331.552C285.287 324.336 285.555 314 286.996 314C287.403 314 287.985 315.853 288.289 318.118ZM737.81 324.852C737.4 334.804 737.059 336.344 733.697 343.424C726.882 357.773 713.38 367.822 691.201 375.051C669.87 382.003 641.478 384.995 596.799 384.998C582.904 384.999 570.906 385.47 567.799 386.135C561.366 387.513 555.764 392.584 554.115 398.523C553.448 400.928 553.009 412.273 553.006 427.231L553 451.962L550.75 452.524C549.513 452.833 544.225 452.954 539 452.793L529.5 452.5L529.208 430C528.703 391.074 531.565 381.065 545.923 371.549C556.38 364.619 556.785 364.576 611.5 364.498C664.99 364.423 671.76 363.934 689.908 358.842C703.728 354.963 714.681 349.113 722.513 341.427C729.264 334.801 734.78 325.059 735.711 318.118C736.015 315.853 736.712 314 737.26 314C737.889 314 738.092 318.008 737.81 324.852ZM551.8 467.2C552.65 468.05 553 473.999 553 487.595C553 504.029 552.709 507.73 550.98 513.331C548.003 522.966 542.739 529.088 533.685 533.443C510.841 544.431 483.42 536.926 474.148 517.148C471.571 511.651 471.491 510.904 471.181 489.217L470.862 466.933L482.181 467.217L493.5 467.5L494 486.5C494.459 503.939 494.683 505.795 496.733 509.09C502.665 518.63 519.466 518.964 526.395 509.681C528.321 507.101 528.542 505.189 529 487.181L529.5 467.5L539.5 466.944C545 466.638 549.748 466.3 550.05 466.194C550.352 466.087 551.14 466.54 551.8 467.2Z";

// Acento por módulo (dot de color)
const MODULE_ACCENT: Record<string, string> = {
  core:     "#6B6BAA",
  scout:    "#3A81FE",
  schedule: "#10B981",
  wellness: "#A78BFA",
  stats:    "#F59E0B",
};

// Wordmark por módulo
const MODULE_WORDMARK: Record<string, string> = {
  core:     "CORE",
  scout:    "SCOUT",
  schedule: "SCHEDULE",
  wellness: "WELLNESS",
  stats:    "STATS",
};

interface ModuleHeaderProps {
  module: "core" | "scout" | "schedule" | "wellness" | "stats";
  tagline: string;
  className?: string;
}

export function ModuleHeader({ module, tagline, className }: ModuleHeaderProps) {
  const [, setLocation] = useLocation();
  const { previewRole } = useAuth();
  const caps = useCapabilities();
  const settingsHref = previewRole
    ? "/settings"
    : caps.canUsePlayerUX
      ? "/player/home-settings"
      : "/settings";

  const accent = MODULE_ACCENT[module] ?? "#3A81FE";
  const wordmark = MODULE_WORDMARK[module] ?? module.toUpperCase();

  return (
    <div className={cn("relative flex flex-col items-center pt-8 pb-6 gap-2 text-foreground", className)}>
      {/* Settings button — top right */}
      <button
        type="button"
        onClick={() => setLocation(settingsHref)}
        className="absolute top-4 right-0 p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors"
        aria-label="Settings"
        data-testid={`${module}-header-settings`}
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* U Mark */}
      <svg
        width={96}
        height={96}
        viewBox={U_MARK_VIEWBOX}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block select-none text-foreground"
        aria-hidden
      >
        <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d={U_MARK_PATH} />
      </svg>

      {/* Accent dot */}
      <div
        className="w-1.5 h-1.5 rounded-full -mt-1"
        style={{ backgroundColor: accent }}
        aria-hidden
      />

      {/* Wordmark */}
      <span
        className="font-black tracking-[0.35em] uppercase text-foreground select-none"
        style={{ fontSize: 15 }}
      >
        {wordmark}
      </span>

      {/* Tagline */}
      <span
        className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground font-medium select-none"
        style={{ opacity: 0.5 }}
      >
        {tagline}
      </span>
    </div>
  );
}
