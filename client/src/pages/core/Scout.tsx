import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/useAuth";
import { useCapabilities } from "@/lib/capabilities";

/**
 * U Core Scout module entrypoint.
 * Safe redirect into legacy U Scout roots.
 * (Legacy pages render their own UI; we add bottom nav directly on those pages.)
 */
export default function Scout() {
  const { profile, loading } = useAuth();
  const caps = useCapabilities();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!profile) setLocation("/login");
    if (caps.canUsePlayerUX) setLocation("/player");
    else setLocation("/coach");
  }, [caps.canUsePlayerUX, loading, profile, setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return null;
}

