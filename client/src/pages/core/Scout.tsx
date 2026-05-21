import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/useAuth";
import { useCapabilities } from "@/lib/capabilities";
import { useIsDesktop } from "@/lib/useIsDesktop";

const CoachHome = lazy(() => import("../scout/CoachHome"));

export default function Scout() {
  const { profile, loading } = useAuth();
  const caps = useCapabilities();
  const isDesktop = useIsDesktop();
  const [, setLocation] = useLocation();

  const isPlayer = caps.canUsePlayerUX;

  useEffect(() => {
    if (loading) return;
    if (!profile) { setLocation("/login"); return; }
    // Players always go to /player
    if (isPlayer) { setLocation("/player"); return; }
    // Staff on mobile go to CoachHome
    if (!isDesktop) { setLocation("/coach"); return; }
  }, [loading, profile, isPlayer, isDesktop, setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Staff + desktop: render CoachHome (workflow: Personnel → My Scout → Film Room → Game Plan)
  if (!isPlayer && isDesktop && profile) {
    return (
      <Suspense fallback={null}>
        <CoachHome />
      </Suspense>
    );
  }

  return null;
}
