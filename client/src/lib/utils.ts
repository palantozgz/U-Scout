import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isRealPhoto(url: string | undefined | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return !lower.includes("pravatar") && !lower.includes("picsum") && !lower.includes("placeholder") && !lower.includes("unsplash");
}
