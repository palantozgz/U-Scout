/**
 * U Scout — splash animada (rAF) + logo estático + marca de agua.
 * Paleta: #060a14 fondo, trazos #e2e8f0.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

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
  const gHornsRef = useRef<SVGGElement>(null);
  const gCourtRef = useRef<SVGGElement>(null);
  const gURef = useRef<SVGGElement>(null);
  const scoutRef = useRef<HTMLParagraphElement>(null);
  const loadingRef = useRef<HTMLParagraphElement>(null);
  const strokeRef = useRef<number>(2.1);

  useEffect(() => {
    if (fadeOut) return;

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const linear = (elapsed % CYCLE_MS) / CYCLE_MS;
      const t = easeInOutCubic(linear);

      const wHorns =
        smoothstep(0, 0.18, t) * (1 - smoothstep(0.36, 0.52, t));
      const wCourt =
        smoothstep(0.28, 0.45, t) * (1 - smoothstep(0.52, 0.7, t));
      const wU = smoothstep(0.55, 0.78, t);

      const oScout = smoothstep(0.62, 0.9, t);
      const oLoad = smoothstep(0.76, 0.98, t);

      const sw = 1.5 + wHorns * 0.9 + wCourt * 0.5 + wU * 0.35;
      strokeRef.current = sw;

      if (gHornsRef.current) {
        gHornsRef.current.setAttribute("opacity", String(Math.max(0, Math.min(1, wHorns))));
        gHornsRef.current.querySelectorAll("path").forEach(p => {
          (p as SVGPathElement).setAttribute("stroke-width", String(sw * 0.95));
        });
      }
      if (gCourtRef.current) {
        gCourtRef.current.setAttribute("opacity", String(Math.max(0, Math.min(1, wCourt))));
        gCourtRef.current.querySelectorAll("path").forEach(p => {
          (p as SVGPathElement).setAttribute("stroke-width", String(sw * 0.88));
        });
      }
      if (gURef.current) {
        gURef.current.setAttribute("opacity", String(Math.max(0, Math.min(1, wU))));
        gURef.current.querySelectorAll("path").forEach(p => {
          (p as SVGPathElement).setAttribute("stroke-width", String(sw));
        });
      }
      if (scoutRef.current) scoutRef.current.style.opacity = String(oScout);
      if (loadingRef.current) loadingRef.current.style.opacity = String(oLoad * 0.95);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fadeOut]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-[400ms] ease-out"
      style={{
        backgroundColor: BG,
        opacity: fadeOut ? 0 : 1,
      }}
      role="status"
      aria-label="Loading"
    >
      <div className="relative w-[min(300px,78vw)] flex flex-col items-center">
        <svg
          viewBox="0 0 200 138"
          className="w-full h-auto overflow-visible"
          aria-hidden
        >
          <g ref={gHornsRef} fill="none" stroke={STROKE} strokeLinecap="round" strokeLinejoin="round" opacity={1}>
            {/* Cuerno izq sube */}
            <path d="M 100 40 C 72 38 48 52 38 78 C 34 88 42 96 52 90 C 62 72 78 52 96 46" />
            {/* Cuerno der baja */}
            <path d="M 100 40 C 128 38 152 52 162 78 C 166 92 158 100 148 92 C 138 78 124 56 104 48" />
            {/* Línea frente / ceja */}
            <path d="M 76 42 Q 100 36 124 42" />
          </g>

          <g ref={gCourtRef} fill="none" stroke={STROKE} strokeLinecap="round" strokeLinejoin="round" opacity={0}>
            {/* Línea de fondo arriba */}
            <path d="M 28 30 L 172 30" />
            {/* Laterales */}
            <path d="M 36 30 L 36 122" />
            <path d="M 164 30 L 164 122" />
            {/* Arco inferior (media cancha) */}
            <path d="M 36 122 Q 100 158 164 122" />
            {/* Arco de tres (sugerido) */}
            <path d="M 48 48 Q 100 22 152 48" />
            {/* Zona colgando */}
            <path d="M 78 30 L 78 104 A 22 22 0 0 0 122 104 L 122 30" />
            <path d="M 84 86 L 116 86" />
          </g>

          <g
            ref={gURef}
            fill="none"
            stroke={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0}
            transform="translate(100 68) skewX(-11) translate(-100 -68)"
          >
            <path d="M 78 28 L 78 106 A 22 22 0 0 0 122 106 L 122 28" />
            <path d="M 84 88 L 116 88" />
          </g>
        </svg>

        <p
          ref={scoutRef}
          className="text-center font-black text-sm mt-1 pl-[0.35em]"
          style={{
            color: STROKE,
            letterSpacing: "0.4em",
            fontStyle: "italic",
            opacity: 0,
          }}
        >
          SCOUT
        </p>

        <p
          ref={loadingRef}
          className="text-xs mt-6 font-medium"
          style={{ color: MUTED_TEXT, opacity: 0 }}
        >
          Loading…
        </p>
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
