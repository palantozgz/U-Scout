# Sprint D — ReportSlidesV1: rediseño 3 slides aprobado

## Archivo objetivo
`client/src/pages/scout/ReportSlidesV1.tsx`

## Contexto
El componente YA tiene toda la lógica: motor, swipe, overrides, Sheet de alternativas,
goTo, handleTouch, handlePointer, arrowsVisible, showSwipeHint.
Solo hay que sustituir el JSX del `return(...)`.
NO tocar nada antes del `return`.

## Spec aprobada
- Slide 0 — ¿Quién es? → foto + archetype (tap=alternativas) + tagline + amenaza (rojo)
- Slide 1 — ¿Qué hará? → top 3 situaciones con icono + descripción (tap=alternativas)
- Slide 2 — ¿Qué hago yo? → DENY/FORCE/ALLOW cards + máx 2 AWARE

## Instrucción para Cursor

Busca exactamente esta línea en el archivo (cerca del final de la función):

```
  const photo = isRealPhoto(player.imageUrl);
```

Sustituye TODO desde esa línea hasta el `}` final de la función con:

```tsx
  const photo = isRealPhoto(player.imageUrl);
  const subAlt = finalReport.identity.archetypeAlternatives[0];
  const topSituations = finalReport.situations.slice(0, 3);
  const topAlerts = finalReport.alerts.slice(0, 2);
  const hasPrev = slide > 0;
  const hasNext = slide < TOTAL_SLIDES - 1;
  const es = locale === "es";
  const zh = locale === "zh";

  const SLIDE_LABELS = [
    es ? "¿Quién es?" : zh ? "她是谁？" : "Who is she?",
    es ? "¿Qué hará?" : zh ? "她会做什么？" : "What will she do?",
    es ? "¿Qué hago yo?" : zh ? "我怎么防？" : "How do I defend?",
  ];

  return (
    <div
      className="flex flex-col bg-background"
      style={{ minHeight: "100dvh" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-20 flex items-center gap-2 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 shrink-0">
        {onBack && (
          <button type="button" onClick={onBack} className="-ml-1 p-2 rounded-lg text-muted-foreground hover:text-foreground" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground truncate">{player.name}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{SLIDE_LABELS[slide]}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <button key={i} type="button" onClick={() => goTo(i)}
              className={cn("rounded-full transition-all", i === slide ? "w-4 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30")}
              aria-label={`Slide ${i + 1}`} />
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">

        {/* SLIDE 0: ¿Quién es? */}
        {slide === 0 && (
          <div className="px-4 pt-6 pb-24 space-y-4 max-w-lg mx-auto">
            <div className="flex items-center gap-4">
              <Suspense fallback={<div className="w-16 h-16 rounded-full bg-muted/40" />}>
                {photo ? (
                  <img src={player.imageUrl} alt={player.name} className="w-16 h-16 rounded-full object-cover ring-2 ring-border shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-border shrink-0">
                    <BasketballPlaceholderAvatar size={64} />
                  </div>
                )}
              </Suspense>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-black text-foreground leading-tight truncate">{player.name}</p>
                {player.number && <p className="text-xs text-muted-foreground font-semibold">#{player.number}</p>}
              </div>
            </div>

            <button type="button" onClick={() => openArchetypeSheet(finalReport.identity.archetype)}
              className="w-full text-left rounded-2xl border border-border bg-card p-4 space-y-1 active:bg-muted/40 transition-colors">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                {es ? "Arquetipo" : zh ? "类型" : "Archetype"}
              </p>
              <p className="text-2xl font-black text-foreground leading-tight">{finalReport.identity.archetype}</p>
              {subAlt && (
                <p className="text-xs text-muted-foreground font-semibold">
                  {es ? "También: " : zh ? "或: " : "Also: "}{subAlt.label}
                </p>
              )}
            </button>

            {finalReport.identity.tagline && (
              <div className="rounded-2xl border border-border bg-card px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">
                  {es ? "Perfil" : zh ? "简述" : "Profile"}
                </p>
                <p className="text-base font-semibold text-foreground leading-snug">{finalReport.identity.tagline}</p>
              </div>
            )}

            {(finalReport.identity as any).threat && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-destructive/70 mb-1">
                  {es ? "Amenaza principal" : zh ? "主要威胁" : "Main threat"}
                </p>
                <p className="text-sm font-semibold text-foreground leading-snug">{(finalReport.identity as any).threat}</p>
              </div>
            )}

            {showSwipeHint && (
              <p className="text-center text-xs text-muted-foreground/50 font-medium pt-2">
                {es ? "Desliza para ver el informe completo →" : zh ? "左滑查看完整报告 →" : "Swipe to see full report →"}
              </p>
            )}
          </div>
        )}

        {/* SLIDE 1: ¿Qué hará? */}
        {slide === 1 && (
          <div className="px-4 pt-6 pb-24 space-y-3 max-w-lg mx-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-4">
              {es ? "Situaciones primarias" : zh ? "主要进攻方式" : "Primary situations"}
            </p>
            {topSituations.map((sit, i) => {
              const icon = SITUATION_ICONS[sit.id as keyof typeof SITUATION_ICONS];
              const desc = renderSituationDescription(
                motorOutput!.situations.find((s) => s.id === sit.id) ?? motorOutput!.situations[i],
                ctx,
                motorOutput!.inputs,
              );
              return (
                <button key={sit.id} type="button" onClick={() => openSituationSheet(sit.id, desc)}
                  className="w-full text-left rounded-2xl border border-border border-l-4 border-l-primary/60 p-4 space-y-2 bg-card active:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2">
                    {icon && <span className="text-lg leading-none">{icon}</span>}
                    <p className="text-xs font-black uppercase tracking-widest text-primary/80">{sit.title}</p>
                    <span className="ml-auto text-[9px] font-black text-muted-foreground/40 tabular-nums">#{i + 1}</span>
                  </div>
                  <p className="text-sm leading-snug text-foreground/85 font-medium">{desc}</p>
                </button>
              );
            })}
            {topSituations.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {es ? "Sin situaciones detectadas" : zh ? "未检测到情况" : "No situations detected"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* SLIDE 2: ¿Qué hago yo? */}
        {slide === 2 && (
          <div className="px-4 pt-6 pb-24 space-y-3 max-w-lg mx-auto">
            {finalReport.defensivePlan.deny.length > 0 && (
              <button type="button" onClick={() => openDefenseSheet("deny", finalReport.defensivePlan.deny[0], [])}
                className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 bg-card active:bg-muted/40 transition-colors", DENY_CLASSES.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", DENY_CLASSES.dot)} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", DENY_CLASSES.text)}>
                    {es ? "Denegar" : zh ? "封堵" : "Deny"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground/90 leading-snug">{finalReport.defensivePlan.deny[0]}</p>
              </button>
            )}
            {finalReport.defensivePlan.force.length > 0 && (
              <button type="button" onClick={() => openDefenseSheet("force", finalReport.defensivePlan.force[0], [])}
                className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 bg-card active:bg-muted/40 transition-colors", FORCE_CLASSES.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", FORCE_CLASSES.dot)} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", FORCE_CLASSES.text)}>
                    {es ? "Forzar" : zh ? "逼迫" : "Force"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground/90 leading-snug">{finalReport.defensivePlan.force[0]}</p>
              </button>
            )}
            {finalReport.defensivePlan.allow.length > 0 && (
              <button type="button" onClick={() => openDefenseSheet("allow", finalReport.defensivePlan.allow[0], [])}
                className={cn("w-full text-left rounded-2xl border border-border border-l-4 p-4 bg-card active:bg-muted/40 transition-colors", ALLOW_CLASSES.border)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", ALLOW_CLASSES.dot)} />
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", ALLOW_CLASSES.text)}>
                    {es ? "Conceder" : zh ? "放开" : "Allow"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-foreground/90 leading-snug">{finalReport.defensivePlan.allow[0]}</p>
              </button>
            )}
            {topAlerts.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {es ? "Alerta" : zh ? "注意" : "Aware"}
                </p>
                {topAlerts.map((alert, i) => (
                  <div key={i} className={cn("rounded-2xl border border-border border-l-4 p-3 bg-card", AWARE_CLASSES.border)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", AWARE_CLASSES.dot)} />
                      <p className={cn("text-[9px] font-black uppercase tracking-widest", AWARE_CLASSES.text)}>AWARE</p>
                    </div>
                    <p className="text-xs font-semibold text-foreground/80 leading-snug">{alert.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Nav arrows ── */}
      <div className={cn(
        "fixed bottom-6 left-0 right-0 flex justify-between px-4 pointer-events-none transition-opacity duration-300 z-20",
        arrowsVisible ? "opacity-100" : "opacity-0",
      )}>
        <button type="button" onClick={() => goTo(slide - 1)} disabled={!hasPrev}
          className={cn("pointer-events-auto w-10 h-10 rounded-full bg-card/90 border border-border flex items-center justify-center shadow-md transition-opacity", hasPrev ? "opacity-100" : "opacity-0")}
          aria-label="Previous">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <button type="button" onClick={() => goTo(slide + 1)} disabled={!hasNext}
          className={cn("pointer-events-auto w-10 h-10 rounded-full bg-card/90 border border-border flex items-center justify-center shadow-md transition-opacity", hasNext ? "opacity-100" : "opacity-0")}
          aria-label="Next">
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {bottomBar && (
        <div className="sticky bottom-0 z-10 bg-background border-t border-border">{bottomBar}</div>
      )}

      {/* ── Sheet alternativas ── */}
      <Sheet open={!!activeSheet} onOpenChange={(o) => { if (!o) setActiveSheet(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[75dvh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base font-black">{activeSheet?.title}</SheetTitle>
          </SheetHeader>
          <div className="mb-3">
            <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">
              {es ? "Actual" : zh ? "当前" : "Current"}
            </p>
            <p className="text-sm font-semibold text-foreground/80">{activeSheet?.current}</p>
          </div>
          {activeSheet && activeSheet.alternatives.length > 0 ? (
            <div className="space-y-2">
              <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground/50">
                {es ? "Alternativas del motor" : zh ? "引擎备选" : "Engine alternatives"}
              </p>
              {activeSheet.alternatives.map((alt, idx) => (
                <div key={idx} className="rounded-xl border border-border/60 bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex-1 text-sm leading-snug text-foreground/85">{alt.text}</p>
                    <span className="shrink-0 text-xs font-black tabular-nums text-muted-foreground/50">{Math.round(alt.score * 100)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground/50">
              {es ? "Sin alternativas disponibles" : zh ? "暂无备选" : "No alternatives available"}
            </p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

## Verificación
```bash
cd "/Users/palant/Downloads/U scout/ucore" && npm run check
```
Exit 0 requerido.

## Notas
- `(finalReport.identity as any).threat` — cast necesario si el tipo no tiene ese campo aún
- `finalReport.defensivePlan.deny/force/allow` son `string[]` — si en la implementación real son objetos `{ instruction: string }`, ajustar a `.deny[0].instruction`
- NO modificar nada antes de `const photo = isRealPhoto(...)`
