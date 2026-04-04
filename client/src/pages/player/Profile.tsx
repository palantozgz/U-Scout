import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { usePlayer, useTeams, generateProfile } from "@/lib/mock-data";
import { useLocale } from "@/lib/i18n";
import { BasketballPlaceholderAvatar } from "@/components/BasketballPlaceholderAvatar";
import { isRealPhoto } from "@/lib/utils";
import { ArrowLeft, ChevronRight, ChevronLeft, ShieldAlert, Shield, Plus, X, BookOpen, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

// ─── translateOutput ──────────────────────────────────────────────────────────
// Converts motor output keys to translated strings at render time.
// Static key:  "def_screen_roll" → t("def_screen_roll")
// Dynamic key: "for_direction|weak=left|wl=floater" → t("for_direction", {weak:"left", wl:"floater"})
// Fallback:    if key not in i18n, display as-is (backwards compatible with old saved data)
function translateOutput(item: string, tFn: (key: any) => string): string {
  if (!item) return item;
  // Check if it's a serialized dynamic key
  if (item.includes("|")) {
    const [key, ...paramParts] = item.split("|");
    const params: Record<string, string> = {};
    paramParts.forEach(p => {
      const [k, v] = p.split("=");
      if (k && v !== undefined) params[k] = v;
    });
    let s = tFn(key);
    // If t() returned the key itself, it's not in i18n — show raw
    if (s === key) return item;
    Object.entries(params).forEach(([k, v]) => {
      // Translate param values too (e.g. {side}=left, {wl}=opt_finish_pullup)
      // If there's no i18n entry for the param value, fallback to the raw one.
      const translatedParam = tFn(v as any);
      const replacement = translatedParam === v ? v : translatedParam;
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), replacement);
    });
    return s;
  }
  // Static key
  const translated = tFn(item);
  // If t() returned the key itself, it's not in i18n — show raw
  return translated === item ? item : translated;
}


const toNum = (v: any, fb = 3): number =>
  typeof v === "number" ? v : v === "High" ? 4 : v === "Low" ? 2 : fb;
const isAct = (f?: string) => f === "Primary" || f === "Secondary";
const isPri = (f?: string) => f === "Primary";

// Translate trait labels from motor — maps motor label to i18n key
/** Legacy motor labels → i18n keys (persisted players). New motor uses `trait_*` keys directly. */
const TRAIT_KEY_MAP: Record<string, string> = {
  "Backdoor": "trait_backdoor",
  "Closeout": "trait_closeout",
  "Crashing": "trait_crashing",
  "Drag Screen": "trait_drag_screen",
  "Dual Role": "trait_dual_role",
  "Duck-In": "trait_duck_in",
  "Force Direction": "trait_force_direction",
  "Funnel Direction": "trait_funnel_direction",
  "Move Pattern": "trait_move_pattern",
  "Off Screens": "trait_off_screens",
  "On the Double": "trait_on_the_double",
  "Pass-First": "trait_pass_first",
  "Perimeter Threat": "trait_perimeter_threat",
  "Screen Action": "trait_screen_action",
  "Screen Coverage": "trait_screen_coverage",
  "Slip Threat": "trait_slip_threat",
  "Transition": "trait_transition",
  "Primary Post Scorer": "trait_primary_post_scorer",
  "Post Threat": "trait_post_threat",
  "Primary Scorer": "trait_primary_scorer",
  "Secondary Creator": "trait_secondary_creator",
};

function keyTraitI18nKey(trait: string): string {
  return TRAIT_KEY_MAP[trait] ?? trait;
}

// ─── BulletCard — respects deepReport mode ────────────────────────────────────
function BulletCard({
  title, top, rest = [], accent, bg, border, deepReport,
}: {
  title: string; top: string[]; rest?: string[];
  accent: string; bg: string; border: string;
  deepReport: boolean;
}) {
  if (!top.length) return null;
  const visible = deepReport ? [...top, ...rest] : top;
  return (
    <div className={`w-full rounded-2xl border ${bg} ${border}`}>
      <div className="px-4 pt-3 pb-3 w-full">
        <p className={`text-[10px] font-black uppercase tracking-widest mb-2.5 ${accent}`}>{title}</p>
        {visible.map((item, i) => (
          <div key={i} className="flex gap-2 items-start mb-2 last:mb-0 w-full min-w-0">
            <span className={`font-black text-sm shrink-0 leading-snug ${accent}`}>—</span>
            <span className="text-sm font-semibold leading-snug text-slate-100 min-w-0 flex-1 break-words whitespace-normal">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PlanCard — respects deepReport mode ──────────────────────────────────────
function PlanCard({ label, symbol, items, accent, bg, border, deepReport }: {
  label: string; symbol: string; items: string[];
  accent: string; bg: string; border: string;
  deepReport: boolean;
}) {
  if (!items.length) return null;
  const visible = deepReport ? items : items.slice(0, 2);
  return (
    <div className={`w-full rounded-2xl border ${bg} ${border}`}>
      <div className="px-4 pt-3 pb-3 w-full">
        <p className={`text-[10px] font-black uppercase tracking-widest mb-2.5 ${accent}`}>{symbol} {label}</p>
        {visible.map((item, i) => (
          <div key={i} className="flex gap-2 items-start mb-2 last:mb-0 w-full min-w-0">
            <span className={`font-black text-sm shrink-0 leading-snug ${accent}`}>{symbol}</span>
            <span className="text-sm font-semibold leading-snug text-slate-100 min-w-0 flex-1 break-words whitespace-normal">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptySlate({ text }: { text: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-25 py-16">
      <ShieldAlert className="w-10 h-10 text-slate-400" />
      <p className="text-sm font-semibold text-slate-400 text-center px-8">{text}</p>
    </div>
  );
}

// ScrollSlide — slide wrapper with top/bottom scroll indicators
function ScrollSlide({ children, accentColor }: { children: React.ReactNode; accentColor: string }) {
  const { t } = useLocale();
  const ref = React.useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = React.useState(false);
  const [canScrollUp,   setCanScrollUp]   = React.useState(false);

  const check = () => {
    const el = ref.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 8);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  };

  React.useEffect(() => {
    check();
    const el = ref.current;
    el?.addEventListener("scroll", check, { passive: true });
    return () => el?.removeEventListener("scroll", check);
  }, [children]);

  return (
    <div
      ref={ref}
      className="relative flex-1 min-h-0 flex flex-col w-full overflow-y-auto overflow-x-hidden bg-[#060a14] scroll-smooth"
    >
      {/* Top fade + indicator */}
      {canScrollUp && (
        <div className="absolute top-0 left-0 w-full h-12 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, #020617 60%, transparent)" }}>
          <div className="flex justify-center pt-1">
            <div className={`w-4 h-4 flex items-center justify-center opacity-60 ${accentColor}`}>
              <svg viewBox="0 0 10 6" className="w-3 h-3 fill-current"><path d="M5 0L10 6H0z"/></svg>
            </div>
          </div>
        </div>
      )}

      <div className="w-full flex flex-col px-5 pt-20 pb-24 gap-3">
        {children}
      </div>

      {/* Bottom fade + indicator */}
      {canScrollDown && (
        <div className="absolute bottom-0 left-0 w-full h-16 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to top, #020617 50%, transparent)" }}>
          <div className="flex justify-center absolute bottom-3 w-full">
            <div className={`flex items-center gap-1 opacity-70 ${accentColor}`}>
              <svg viewBox="0 0 10 6" className="w-3 h-3 fill-current rotate-180"><path d="M5 0L10 6H0z"/></svg>
              <span className="text-[9px] font-black uppercase tracking-widest">{t("scroll")}</span>
              <svg viewBox="0 0 10 6" className="w-3 h-3 fill-current rotate-180"><path d="M5 0L10 6H0z"/></svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main ──────────────────────────────────────────────────────────────────────
export default function PlayerProfileViewer() {
  const { t } = useLocale();
  const [, params] = useRoute("/player/:id");
  const [, paramsCoach] = useRoute("/coach/player/:id/profile");
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(0);
  const [dir,  setDir]  = useState(0);
  const [deepReport, setDeepReport] = useState(false);

  const { data: player, isLoading: pLoad } = usePlayer(params?.id ?? paramsCoach?.id ?? "");
  const { data: teams = [], isLoading: tLoad } = useTeams();
  const team = teams.find(t => t.id === player?.teamId);

  if (pLoad || tLoad) return (
    <div className="flex items-center justify-center h-[100dvh] bg-[#060a14]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!player || !team) return (
    <div className="flex flex-col items-center justify-center h-[100dvh] bg-[#060a14] p-6 text-center gap-4">
      <ShieldAlert className="w-16 h-16 text-slate-700" />
      <h2 className="text-xl font-bold text-white">{t("profile_not_found")}</h2>
      <Button onClick={() => setLocation(paramsCoach ? "/coach/reports" : "/player")} variant="outline">{t("back")}</Button>
    </div>
  );

  const inp = player.scoutingInputs ?? player.inputs;
  const generated = React.useMemo(() => generateProfile(inp, player.name), [player?.id, inp, player?.name]);
  const im  = generated.internalModel;
  const dp  = generated.defensivePlan ?? { defender: [], forzar: [], concede: [] };
  const archetype = generated.archetype ?? player.archetype;
  const keyTraits = generated.keyTraits ?? player.keyTraits;

  const getTraits = (arr: any[] = []) =>
    arr.map((item: any) => {
      const raw = typeof item === "string" ? item : (item?.valueToken ?? item?.value);
      return raw ? translateOutput(raw, t) : null;
    }).filter(Boolean) as string[];

  const postTraits    = getTraits(im?.postTraits);
  const isoTraits     = getTraits(im?.isoTraits);
  const pnrTraits     = getTraits(im?.pnrTraits);
  const offBallTraits = getTraits(im?.offBallTraits);

  const postScore    = (im?.postTraits    ?? []).reduce((s: number, t: any) => s + (t?.score ?? 0), 0);
  const isoScore     = (im?.isoTraits     ?? []).reduce((s: number, t: any) => s + (t?.score ?? 0), 0);
  const pnrScore     = (im?.pnrTraits     ?? []).reduce((s: number, t: any) => s + (t?.score ?? 0), 0);
  const offBallScore = (im?.offBallTraits ?? []).reduce((s: number, t: any) => s + (t?.score ?? 0), 0);

  // Threats ordered by danger
  const allThreatSections = [
    { label: "tab_post",     traits: postTraits,    score: postScore,    freq: inp.postFrequency,       accent: "text-purple-400", bg: "bg-purple-950/40", border: "border-purple-800/30" },
    { label: "tab_iso",      traits: isoTraits,     score: isoScore,     freq: inp.isoFrequency,        accent: "text-orange-400", bg: "bg-orange-950/40", border: "border-orange-800/30" },
    { label: "tab_pnr",      traits: pnrTraits,     score: pnrScore,     freq: inp.pnrFrequency,        accent: "text-blue-400",   bg: "bg-blue-950/40",   border: "border-blue-800/30"   },
    { label: "tab_offball", traits: offBallTraits, score: offBallScore, freq: inp.transitionFrequency, accent: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-800/30" },
  ].filter(s => s.traits.length > 0).sort((a, b) => b.score - a.score);

  // Slide 3 — spatial
  const slide3Items: string[] = [];
  if (im?.dominantSide && im.dominantSide !== "Ambidextrous") {
    const weak = im.dominantSide === "Right" ? "left" : "right";
    slide3Items.push(`spatial_goes|side=${im.dominantSide.toLowerCase()}|weak=${weak}`);
  } else if (im?.dominantSide === "Ambidextrous") {
    slide3Items.push("spatial_ambidextrous");
  }
  if (isAct(inp.postFrequency) && inp.postPreferredBlock && inp.postPreferredBlock !== "Any") {
    const block = inp.postPreferredBlock.toLowerCase().replace(" block", "");
    slide3Items.push(`spatial_post_block|block=${block}`);
  }
  if (isPri(inp.transitionFrequency)) {
    if (inp.transitionRole === "Pusher") slide3Items.push("spatial_trans_pusher");
    else if (inp.transitionRole === "Rim Runner") slide3Items.push("spatial_trans_runner");
    else if (inp.transitionRole === "Outlet") slide3Items.push("spatial_trans_outlet");
    else if (inp.transitionRole === "Trailer") slide3Items.push("spatial_trans_trailer");
    else slide3Items.push("spatial_transition_active");
  }
  if (isPri(inp.backdoorFrequency)) {
    slide3Items.push("spatial_backdoor_primary");
  } else if (isAct(inp.backdoorFrequency)) {
    slide3Items.push("spatial_backdoor_active");
  }
  if (isPri(inp.indirectsFrequency)) {
    slide3Items.push("spatial_indirects");
  }
  if (isPri(inp.offensiveReboundFrequency)) {
    slide3Items.push("spatial_crashing");
  }
  if ((inp as any).pnrTiming === "Early (Drag)") {
    slide3Items.push("spatial_drag_screens");
  }
  if (slide3Items.length === 0) slide3Items.push("no_spatial");

  // Slide 4 — PnR
  const slide4Items = [...pnrTraits];
  if ((inp as any).slipFrequency && isAct((inp as any).slipFrequency)) {
    slide4Items.push(translateOutput("spatial_slips", t));
  }

  const ath  = toNum(inp.athleticism, 3);
  const phys = toNum(inp.physicalStrength, 3);
  const vis  = toNum((inp as any).courtVision, 3);
  const subArch = generated.subArchetype;

  // ── SLIDE 1 — Identity ────────────────────────────────────────────────────
  const S1 = (
    <div className="h-full min-h-0 flex flex-col items-center justify-center text-center px-6 gap-5 bg-[#060a14] overflow-y-auto">
      <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
      <div className="relative mt-4">
        <div className="absolute inset-0 blur-2xl opacity-25 rounded-full bg-orange-500" />
        {isRealPhoto(player.imageUrl)
          ? <img src={player.imageUrl} alt={player.name}
              className="w-32 h-32 rounded-full object-cover border-4 border-orange-500/30 shadow-2xl relative z-10" />
          : <div className="w-32 h-32 rounded-full border-4 border-orange-500/30 shadow-2xl relative z-10 overflow-hidden">
              <BasketballPlaceholderAvatar size={128} />
            </div>
        }
        <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full border-2 border-slate-950 flex items-center justify-center text-white font-black text-sm z-20 bg-orange-500 shadow-lg">
          {player.number}
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">{player.name}</h1>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
          {inp.position} · {inp.height} · {inp.weight}
        </p>
      </div>

      {/* Archetype + subarchetype */}
      <div className="w-full bg-orange-500/10 border border-orange-500/20 rounded-2xl px-5 py-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-1">{t("archetype")}</p>
        <p className="text-2xl font-black italic text-white leading-tight">{archetype ? t(archetype as any) : "—"}</p>
        {subArch && (
          <p className="text-xs font-bold text-orange-400/60 uppercase tracking-widest mt-1">
            {t("subarchetype_label")} {subArch ? t(subArch as any) : ""}
          </p>
        )}
      </div>

      {/* Key traits */}
      {keyTraits && keyTraits.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {keyTraits.slice(0, 3).map((trait, i) => {
            const label = t(keyTraitI18nKey(trait) as any);
            return <span key={i} className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-xs font-bold border border-slate-700">{label}</span>;
          })}
        </div>
      )}

      {/* Physical tags */}
      <div className="flex flex-wrap justify-center gap-2">
        {ath === 5  && <span className="text-xs font-bold text-yellow-300 bg-yellow-500/15 px-3 py-1 rounded-full">⚡ {t("elite_athlete")}</span>}
        {ath === 4  && <span className="text-xs font-bold text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-full">⚡ {t("athletic")}</span>}
        {ath <= 1   && <span className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-full">{t("limited_athlete")}</span>}
        {phys === 5 && <span className="text-xs font-bold text-red-300 bg-red-500/15 px-3 py-1 rounded-full">💪 {t("physically_dominant")}</span>}
        {phys === 4 && <span className="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full">💪 {t("physical")}</span>}
        {vis >= 4   && <span className="text-xs font-bold text-blue-300 bg-blue-500/10 px-3 py-1 rounded-full">🧠 {vis === 5 ? t("elite_vision") : t("high_iq")}</span>}
      </div>
    </div>
  );

  // ── SLIDE 2 — How she attacks ─────────────────────────────────────────────
  const S2 = (
    <div className="relative h-full min-h-0 bg-[#060a14] flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1 bg-red-500 z-20" />
      <ScrollSlide accentColor="text-red-400">
      <h2 className="text-lg font-black text-white">⚠ {t("how_she_attacks")}</h2>
      <p className="text-xs text-slate-500 -mt-1">{t("top_threats")}</p>
      {allThreatSections.length === 0
        ? <EmptySlate text={t("no_threats")} />
        : allThreatSections.map((s, i) => (
          <BulletCard key={i}
            title={`${t(s.label as any)} · ${s.freq ? t(("freq_" + s.freq.toLowerCase()) as any) : ""}`}
            top={s.traits.slice(0, 2)}
            rest={s.traits.slice(2)}
            accent={s.accent} bg={s.bg} border={s.border}
            deepReport={deepReport}
          />
        ))
      }
      </ScrollSlide>
    </div>
  );

  // ── SLIDE 3 — Where dangerous ─────────────────────────────────────────────
  const slide3TranslatedItems = slide3Items.map(s => translateOutput(s, t));
  const S3 = (
    <div className="relative h-full min-h-0 bg-[#060a14] flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 z-20" />
      <ScrollSlide accentColor="text-amber-400">
      <h2 className="text-lg font-black text-white">📍 {t("where_dangerous")}</h2>
      <p className="text-xs text-slate-500 -mt-1">{t("direction_space")}</p>
      <BulletCard
        title={t("spatial_reads")}
        top={slide3TranslatedItems.slice(0, 2)}
        rest={slide3TranslatedItems.slice(2)}
        accent="text-amber-400" bg="bg-amber-950/40" border="border-amber-800/30"
        deepReport={deepReport}
      />
      </ScrollSlide>
    </div>
  );

  // ── SLIDE 4 — Screens ─────────────────────────────────────────────────────
  const S4 = (
    <div className="relative h-full min-h-0 bg-[#060a14] flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 z-20" />
      <ScrollSlide accentColor="text-blue-400">
      <h2 className="text-lg font-black text-white">⚡ {t("screens_actions")}</h2>
      <p className="text-xs text-slate-500 -mt-1">{t("pnr_coverage")}</p>
      {slide4Items.length > 0
        ? <BulletCard
            title={`${t("tab_pnr")} · ${inp.pnrFrequency ? t(("freq_" + inp.pnrFrequency.toLowerCase()) as any) : ""}`}
            top={slide4Items.slice(0, 2)}
            rest={slide4Items.slice(2)}
            accent="text-blue-400" bg="bg-blue-950/40" border="border-blue-800/30"
            deepReport={deepReport}
          />
        : <EmptySlate text={t("no_pnr")} />
      }
      </ScrollSlide>
    </div>
  );

  // ── SLIDE 5 — Defensive plan ──────────────────────────────────────────────
  const defender = (dp.defender ?? []).map(s => translateOutput(s, t));
  const forzar   = (dp.forzar   ?? []).map(s => translateOutput(s, t));
  const concede  = (dp.concede  ?? []).map(s => translateOutput(s, t));
  const hasPlan  = defender.length > 0 || forzar.length > 0 || concede.length > 0;

  const S5 = (
    <div className="relative h-full min-h-0 bg-[#060a14] flex flex-col">
      <div className="absolute top-0 left-0 w-full h-1 bg-slate-500 z-20" />
      <ScrollSlide accentColor="text-slate-400">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-slate-400" />
        <h2 className="text-lg font-black text-white">{t("defensive_plan")}</h2>
      </div>
      <p className="text-xs text-slate-500 -mt-1">{t("full_plan")}</p>
      {!hasPlan
        ? <EmptySlate text={t("save_to_generate")} />
        : <>
            <PlanCard label={t("defend_tab")} symbol="—" items={defender}
              accent="text-red-400" bg="bg-red-950/40" border="border-red-800/30" deepReport={deepReport} />
            <PlanCard label={t("force_tab")} symbol="→" items={forzar}
              accent="text-blue-400" bg="bg-blue-950/40" border="border-blue-800/30" deepReport={deepReport} />
            <PlanCard label={t("give_tab")} symbol="✓" items={concede}
              accent="text-emerald-400" bg="bg-emerald-950/40" border="border-emerald-800/30" deepReport={deepReport} />
          </>
      }
      </ScrollSlide>
    </div>
  );

  // ── Navigation ─────────────────────────────────────────────────────────────
  const PAGES = [
    { id: "identity", node: S1, color: "bg-orange-500" },
    { id: "attack",   node: S2, color: "bg-red-500"    },
    { id: "space",    node: S3, color: "bg-amber-500"  },
    { id: "screens",  node: S4, color: "bg-blue-500"   },
    { id: "plan",     node: S5, color: "bg-slate-500"  },
  ];
  const total = PAGES.length;
  const next  = () => { setDir(1);  setPage(p => Math.min(total - 1, p + 1)); };
  const prev  = () => { setDir(-1); setPage(p => Math.max(0, p - 1)); };

  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#060a14] overflow-hidden relative">

      {/* Header */}
      <header className="absolute top-0 w-full z-50 px-4 pt-4 flex justify-between items-center">
        <Button variant="ghost" size="icon" onClick={() => setLocation(paramsCoach ? "/coach/reports" : "/player")}
          className="bg-slate-800/80 backdrop-blur rounded-full border-0 text-white hover:bg-slate-700">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Page dots */}
        <div className="flex gap-1.5 items-center p-2 bg-slate-900/60 backdrop-blur rounded-full">
          {PAGES.map((p, i) => (
            <button key={i} onClick={() => { setDir(i > page ? 1 : -1); setPage(i); }}
              className={`rounded-full transition-all duration-300 ${page === i ? `w-5 h-2 ${p.color}` : "w-2 h-2 bg-slate-700"}`} />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/player/settings")}
            className="bg-slate-800/80 backdrop-blur rounded-full border-0 text-slate-400 hover:text-white w-9 h-9">
            <Settings className="w-4 h-4" />
          </Button>

        {/* Deep Report toggle — book icon + label */}
        <button
          onClick={() => setDeepReport(v => !v)}
          className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all"
          title={deepReport ? t("deep_report_on") : t("deep_report_off")}
        >
          <BookOpen className={`w-4 h-4 transition-colors ${deepReport ? "text-amber-400" : "text-slate-500"}`} />
          <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${deepReport ? "text-amber-400" : "text-slate-600"}`}>
            {deepReport ? t("deep") : t("basic")}
          </span>
        </button>
        </div>
      </header>

      {/* Swipeable content */}
      <div className="flex-1 relative min-h-0">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div key={`${page}-${deepReport}`} custom={dir}
            variants={variants} initial="enter" animate="center" exit="exit"
            transition={{ type: "tween", duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0 w-full h-full min-h-0 overflow-hidden"
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.12}
            onDragEnd={(_, { offset, velocity }) => {
              if (Math.abs(velocity.x) > 400) { velocity.x < 0 ? next() : prev(); }
              else if (Math.abs(offset.x) > 60) { offset.x < 0 ? next() : prev(); }
            }}>
            {PAGES[page].node}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav arrows */}
      <div className="absolute bottom-6 left-0 w-full flex justify-between px-6 z-50 pointer-events-none">
        <Button variant="ghost" size="icon" onClick={prev}
          className={`rounded-full pointer-events-auto border-0 w-12 h-12 bg-slate-800/80 text-white transition-opacity ${page === 0 ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <Button variant="ghost" size="icon" onClick={next}
          className={`rounded-full pointer-events-auto border-0 w-12 h-12 bg-slate-800/80 text-white transition-opacity ${page === total - 1 ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
