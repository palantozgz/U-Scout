import { BookOpen } from "lucide-react";
import { ModuleNav } from "@/pages/core/ModuleNav";
import { ModuleHeader } from "@/components/branding/ModuleHeader";
import { useLocale } from "@/lib/i18n";

const L = {
  en: {
    tagline: "Team tactics & strategy",
    heading: "U Playbook",
    sub: "We're building something special here.",
    desc: "Play design, tactical boards, and shared game plans — coming soon to your team.",
    badge: "IN DEVELOPMENT",
  },
  es: {
    tagline: "Táctica y estrategia de equipo",
    heading: "U Playbook",
    sub: "Esto va a estar muy bien.",
    desc: "Diseño de jugadas, pizarras tácticas y planes de partido compartidos — próximamente.",
    badge: "EN DESARROLLO",
  },
  zh: {
    tagline: "球队战术与策略",
    heading: "U Playbook",
    sub: "正在精心打造中。",
    desc: "战术设计、战术板和共享比赛方案 — 即将上线。",
    badge: "开发中",
  },
} as const;

export default function Playbook() {
  const { locale } = useLocale();
  const t = L[(locale as keyof typeof L) ?? "en"] ?? L.en;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground overflow-hidden pb-16 md:pb-0">
      <main className="relative z-10 flex flex-col flex-1 px-4 md:px-8 max-w-5xl mx-auto w-full">

        <ModuleHeader
          module="core"
          tagline={t.tagline}
          className="md:py-3"
        />

        {/* Content — fills remaining space, vertically centered */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 pb-12 md:pb-20">

          {/* Icon halo */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-32 h-32 rounded-full bg-primary/8 blur-2xl" />
            <div className="relative w-20 h-20 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-primary opacity-80" strokeWidth={1.5} />
            </div>
          </div>

          {/* Text block */}
          <div className="text-center max-w-sm px-2">
            <span className="inline-block text-[9px] font-black tracking-[3px] uppercase text-primary/60 mb-3 border border-primary/20 rounded-full px-3 py-1">
              {t.badge}
            </span>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground mb-2">
              {t.heading}
            </h1>
            <p className="text-base font-bold text-foreground/70 mb-3">
              {t.sub}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t.desc}
            </p>
          </div>

          {/* Decorative feature pills */}
          <div className="flex flex-wrap justify-center gap-2 max-w-xs">
            {[
              { en: "Play diagrams", es: "Diagramas de jugadas", zh: "战术图解" },
              { en: "Tactical board", es: "Pizarra táctica", zh: "战术板" },
              { en: "Shared game plans", es: "Planes compartidos", zh: "共享方案" },
              { en: "Video links", es: "Vídeo", zh: "视频链接" },
            ].map((f) => (
              <span
                key={f.en}
                className="text-[10px] font-bold text-muted-foreground/60 border border-border/50 rounded-full px-3 py-1 bg-card/40"
              >
                {f[locale as "en" | "es" | "zh"] ?? f.en}
              </span>
            ))}
          </div>

        </div>
      </main>

      <ModuleNav />
    </div>
  );
}
