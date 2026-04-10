/**
 * U Scout — splash animada (rAF) + logo estático + marca de agua.
 * Paleta: #060a14 fondo, trazos #e2e8f0.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { UScoutLogo } from "@/components/UScoutLogo";

const BG = "#060a14";
const STROKE = "#e2e8f0";
const MUTED_TEXT = "#475569";
const CYCLE_MS = 5500;

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

type NbaAuthSplashProps = {
  /** Cuando true, el contenedor hace fade out 400ms (loading terminó). */
  fadeOut: boolean;
};

/**
 * Splash fullscreen: morfología suave toro → media cancha → U + SCOUT (ciclo 5.5s en bucle mientras visible).
 */
export function NbaAuthSplash({ fadeOut }: NbaAuthSplashProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-[400ms] ease-out"
      style={{ opacity: fadeOut ? 0 : 1 }}
      role="status"
      aria-label="Loading"
    >
      <style>
        {`
          @keyframes uscout-splash-fadein {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .uscout-splash-fadein {
            animation: uscout-splash-fadein 800ms ease-out both;
          }
        `}
      </style>
      <div className="uscout-splash-fadein text-foreground">
        <UScoutLogo size={276} animated={false} />
      </div>
    </div>
  );
}

/** Logo U + SCOUT estático (Coach Home, etc.). */
export function UScoutLogoStatic({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox="0 0 200 120" className="w-36 h-auto sm:w-40 text-[#e2e8f0]" aria-hidden>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(100 56) skewX(-11) translate(-100 -56)"
        >
          <path d="M 78 24 L 78 102 A 22 22 0 0 0 122 102 L 122 24" />
          <path d="M 84 84 L 116 84" />
        </g>
      </svg>
      <span
        className="font-black text-xs sm:text-sm tracking-[0.42em] text-[#e2e8f9] mt-1 pl-[0.42em] italic"
      >
        SCOUT
      </span>
    </div>
  );
}

type WatermarkProps = {
  position?: "bottom-right" | "center";
  className?: string;
};

/** Marca de agua muy suave. */
export function UScoutWatermark({ position = "bottom-right", className = "" }: WatermarkProps) {
  const pos =
    position === "center"
      ? "absolute inset-0 flex items-center justify-center pointer-events-none"
      : "absolute bottom-8 right-4 md:right-8 pointer-events-none";

  return (
    <div className={`${pos} z-0 select-none ${className}`} aria-hidden>
      <motion.div
        className="text-[#e2e8f0]/[0.06]"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex flex-col items-center" style={{ transform: "skewX(-10deg)" }}>
          <svg viewBox="0 0 200 120" className="w-24 h-auto opacity-90">
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(100 56) skewX(-11) translate(-100 -56)"
            >
              <path d="M 78 24 L 78 102 A 22 22 0 0 0 122 102 L 122 24" />
              <path d="M 84 84 L 116 84" />
            </g>
          </svg>
          <span className="font-black text-[9px] tracking-[0.4em] text-current mt-0.5 pl-[0.4em] italic">
            SCOUT
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/** @deprecated Usar NbaAuthSplash; se mantiene export por compatibilidad. */
export function AuthLoadingSplash() {
  return <NbaAuthSplash fadeOut={false} />;
}
