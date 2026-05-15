import { lazy, Suspense } from "react";
import { useIsDesktop } from "@/lib/useIsDesktop";

const HomeMobile  = lazy(() => import("./HomeMobile"));
const HomeDesktop = lazy(() => import("./HomeDesktop"));

export default function Home() {
  const isDesktop = useIsDesktop();
  return (
    <Suspense fallback={null}>
      {isDesktop ? <HomeDesktop /> : <HomeMobile />}
    </Suspense>
  );
}
