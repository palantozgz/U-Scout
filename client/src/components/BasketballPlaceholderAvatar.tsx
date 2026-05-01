import { cn } from "@/lib/utils";

export function BasketballPlaceholderAvatar({
  size = 48,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const r = size / 2;
  const s = size;
  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      {/* Ball */}
      <circle cx={r} cy={r} r={r - 1} fill="#e8610a" />
      {/* Seams */}
      <path
        d={`M ${r} 1 Q ${s * 0.72} ${r} ${r} ${s - 1}`}
        fill="none"
        stroke="#000"
        strokeOpacity="0.22"
        strokeWidth={s * 0.045}
      />
      <path
        d={`M ${r} 1 Q ${s * 0.28} ${r} ${r} ${s - 1}`}
        fill="none"
        stroke="#000"
        strokeOpacity="0.22"
        strokeWidth={s * 0.045}
      />
      <line
        x1="1"
        y1={r}
        x2={s - 1}
        y2={r}
        stroke="#000"
        strokeOpacity="0.22"
        strokeWidth={s * 0.045}
      />
      {/* Border */}
      <circle
        cx={r}
        cy={r}
        r={r - 1}
        fill="none"
        stroke="#000"
        strokeOpacity="0.12"
        strokeWidth="1"
      />
    </svg>
  );
}
