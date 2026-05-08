import { cn } from "@/lib/utils";

/**
 * Silueta limpia de jugador de baloncesto.
 * Usa CSS variables del tema → funciona en Dark, Office y Classic.
 * Diseñada para verse bien dentro de contenedores rounded-full overflow-hidden.
 */
export function BasketballPlaceholderAvatar({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Fondo */}
      <rect width="100" height="100" fill="hsl(var(--muted))" />

      {/* Silueta — color muted-foreground con opacidad */}
      <g fill="hsl(var(--muted-foreground))" opacity="0.45">
        {/* Cabeza */}
        <circle cx="50" cy="32" r="16" />

        {/* Cuerpo + hombros — forma suave tipo avatar iOS */}
        <path d="M 10,105 Q 10,62 50,57 Q 90,62 90,105 Z" />
      </g>
    </svg>
  );
}
