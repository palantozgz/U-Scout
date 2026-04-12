import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/lib/useAuth";
import { useClub } from "@/lib/club-api";
import type { ClubGender } from "@shared/club-context";

export const ClubGenderContext = createContext<ClubGender | null | undefined>(undefined);

export function ClubGenderProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const q = useClub({ enabled: Boolean(user) });
  const gender = (q.data?.club?.gender ?? null) as ClubGender | null;
  return <ClubGenderContext.Provider value={gender}>{children}</ClubGenderContext.Provider>;
}

/** `undefined` = outside provider (treat as no club gender). */
export function useClubGenderValue(): ClubGender | null {
  const v = useContext(ClubGenderContext);
  if (v === undefined) return null;
  return v;
}
