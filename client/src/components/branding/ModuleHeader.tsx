/**
 * ModuleHeader — cabecera estándar para todos los módulos de U CORE.
 * Todos los módulos tienen exactamente el mismo tamaño y formato.
 * Solo cambia el wordmark y el tagline según el módulo.
 */

import { useLocation } from "wouter";
import { Settings } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useCapabilities } from "@/lib/capabilities";
import { cn } from "@/lib/utils";

// U mark — solo las primeras 3 subpaths (alas + puente), sin las letras SCOUT
const U_MARK_PATH =
  "M288.289 318.118C289.221 325.07 294.736 334.799 301.552 341.515C312.636 352.436 329.068 359.222 352.865 362.704C362.461 364.109 373.085 364.43 413.5 364.539C444.206 364.622 463.62 365.057 465.5 365.703C482.094 371.409 490.715 381.404 492.955 397.534C494.205 406.54 494.432 450.968 493.234 452.166C492.735 452.665 487.64 452.945 481.913 452.787L471.5 452.5L470.904 426.5C470.134 392.886 469.331 390.594 457.072 387.048C451.513 385.44 445.875 385.061 420.5 384.59C373.973 383.726 353.073 381.434 332.5 374.939C318.536 370.53 309.727 365.665 301.395 357.761C292.764 349.574 288.302 341.702 286.54 331.552C285.287 324.336 285.555 314 286.996 314C287.403 314 287.985 315.853 288.289 318.118ZM737.81 324.852C737.4 334.804 737.059 336.344 733.697 343.424C726.882 357.773 713.38 367.822 691.201 375.051C669.87 382.003 641.478 384.995 596.799 384.998C582.904 384.999 570.906 385.47 567.799 386.135C561.366 387.513 555.764 392.584 554.115 398.523C553.448 400.928 553.009 412.273 553.006 427.231L553 451.962L550.75 452.524C549.513 452.833 544.225 452.954 539 452.793L529.5 452.5L529.208 430C528.703 391.074 531.565 381.065 545.923 371.549C556.38 364.619 556.785 364.576 611.5 364.498C664.99 364.423 671.76 363.934 689.908 358.842C703.728 354.963 714.681 349.113 722.513 341.427C729.264 334.801 734.78 325.059 735.711 318.118C736.015 315.853 736.712 314 737.26 314C737.889 314 738.092 318.008 737.81 324.852ZM551.8 467.2C552.65 468.05 553 473.999 553 487.595C553 504.029 552.709 507.73 550.98 513.331C548.003 522.966 542.739 529.088 533.685 533.443C510.841 544.431 483.42 536.926 474.148 517.148C471.571 511.651 471.491 510.904 471.181 489.217L470.862 466.933L482.181 467.217L493.5 467.5L494 486.5C494.459 503.939 494.683 505.795 496.733 509.09C502.665 518.63 519.466 518.964 526.395 509.681C528.321 507.101 528.542 505.189 529 487.181L529.5 467.5L539.5 466.944C545 466.638 549.748 466.3 550.05 466.194C550.352 466.087 551.14 466.54 551.8 467.2Z";

// Tamaño único para todos los módulos
const MARK_SIZE = 88;

// Padding único para todos — ajustado para no provocar scroll
const HEADER_PT = "0.75rem";
const HEADER_PB = "0.4rem";
const HEADER_GAP = "0.25rem";

const MODULE_WORDMARK: Record<string, string> = {
  core:     "CORE",
  scout:    "SCOUT",
  schedule: "SCHEDULE",
  wellness: "WELLNESS",
  stats:    "STATS",
};

const MODULE_ACCENT: Record<string, string> = {
  core:     "#6B6BAA",
  scout:    "#3A81FE",
  schedule: "#10B981",
  wellness: "#A78BFA",
  stats:    "#F59E0B",
};

export interface ModuleHeaderProps {
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

  const wordmark = MODULE_WORDMARK[module] ?? module.toUpperCase();
  const accent = MODULE_ACCENT[module] ?? "#3A81FE";

  return (
    <div
      className={cn("relative flex flex-col items-center text-foreground", className)}
      style={{ paddingTop: HEADER_PT, paddingBottom: HEADER_PB, gap: HEADER_GAP }}
    >
      {/* Settings — top right, siempre en la misma posición */}
      <button
        type="button"
        onClick={() => setLocation(settingsHref)}
        className="absolute top-3 right-0 p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors"
        aria-label="Settings"
        data-testid={`${module}-header-settings`}
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* U mark — mismo tamaño y viewBox en todos */}
      <svg
        viewBox="0 0 1024 1024"
        style={{ height: MARK_SIZE, width: MARK_SIZE, display: "block", color: "currentColor" }}
        aria-hidden
      >
        <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d={U_MARK_PATH} />
      </svg>

      {/* Wordmark — mismo estilo en todos */}
      <span
        style={{
          fontSize: "11px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          opacity: 0.45,
          fontWeight: 500,
        }}
      >
        {wordmark}
      </span>

      {/* Tagline — mismo estilo en todos */}
      <span
        style={{
          fontSize: "10px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          opacity: 0.28,
          fontWeight: 500,
        }}
      >
        {tagline}
      </span>

      {/* Accent dot — único elemento diferenciador por módulo */}
      <div
        style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: accent }}
        aria-hidden
      />
    </div>
  );
}
