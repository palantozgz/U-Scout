import { useState, useEffect } from 'react';
import { Shield, Zap, BookOpen, Film, ChevronRight, RotateCcw, CheckCircle2, AlertCircle, Plus, ArrowLeft, Save } from 'lucide-react';
import { ModuleNav } from '@/pages/core/ModuleNav';
import { ModuleHeader } from '@/components/branding/ModuleHeader';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  STEPS, COV_SUBTYPE_OPTS,
  coverageViabilityError, validateAll, buildReport,
  type Answers, type Report,
} from '@/lib/defensive-system';

// ── Types ─────────────────────────────────────────────────────────────────────

type PlaybookView = 'hub' | 'wizard-defensive' | 'wizard-offensive' | 'wizard-atos';

interface SavedPlan {
  id: string;
  name: string;
  createdAt: string;
  report: Report;
  answers: Answers;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'playbook_defensive_plans';

function loadPlans(): SavedPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePlan(plan: SavedPlan): void {
  const plans = loadPlans();
  plans.unshift(plan);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.slice(0, 20)));
}

// ── ReportSection ─────────────────────────────────────────────────────────────

function ReportSection({ title, items, type = 'list' }: { title: string; items: string[]; type?: 'list' | 'text' }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-[9px] font-black tracking-[2px] uppercase text-primary/70">{title}</h4>
      {type === 'text' ? (
        <p className="text-xs text-foreground/80 leading-relaxed">{items.join(' ')}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground/80 leading-relaxed">
              <ChevronRight className="w-3 h-3 text-primary/50 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── ReportView ────────────────────────────────────────────────────────────────

function ReportView({ report, onSave }: { report: Report; onSave?: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-black tracking-[2px] uppercase text-emerald-500/70 mb-0.5">Sistema generado</p>
            <h3 className="text-lg font-black text-foreground leading-tight">{report.name}</h3>
          </div>
        </div>
        {onSave && (
          <button type="button" onClick={onSave}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0 hover:bg-primary/90 transition-colors">
            <Save className="w-3.5 h-3.5" />
            Guardar
          </button>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <ReportSection title="Identidad defensiva" items={[report.identity]} type="text" />
        <ReportSection title="Ancla (shell + subtipo)" items={report.anchor} />
        <ReportSection title="Sistema de media cancha derivado" items={report.derivedSystem} />
        <ReportSection title="Trade-offs estructurales" items={report.tradeOffs} />
        <ReportSection title="Fortalezas" items={report.st} />
        <ReportSection title="Debilidades" items={report.wk} />
        <ReportSection title="Plan de transición" items={report.trans} />
        <ReportSection title="Plan de rebote" items={report.reb} />
        <ReportSection title="Defensa temprana" items={report.early} type="text" />
        <ReportSection title="Uso ideal" items={report.us} />
        {report.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3">
            <p className="text-[9px] font-black tracking-[2px] uppercase text-amber-500/70 mb-1.5">Avisos de staff</p>
            {report.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{w}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ComingSoonWizard ──────────────────────────────────────────────────────────

function ComingSoonWizard({ icon: Icon, title, desc }: { icon: typeof Shield; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 pb-16 text-center px-6">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-28 h-28 rounded-full bg-primary/8 blur-2xl" />
        <div className="relative w-16 h-16 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-center">
          <Icon className="w-8 h-8 text-primary opacity-60" strokeWidth={1.5} />
        </div>
      </div>
      <div>
        <span className="inline-block text-[9px] font-black tracking-[3px] uppercase text-primary/50 mb-3 border border-primary/20 rounded-full px-3 py-1">EN DESARROLLO</span>
        <h2 className="text-xl font-black text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{desc}</p>
      </div>
    </div>
  );
}

// ── DefensiveSystemBuilder ────────────────────────────────────────────────────

interface WizardState {
  answers: Answers;
  stepIndex: number;
  history: { stepIndex: number; answers: Answers }[];
}

function DefensiveSystemBuilder({ onSaved }: { onSaved: () => void }) {
  const [wizard, setWizard] = useState<WizardState>({ answers: {}, stepIndex: 0, history: [] });
  const [report, setReport] = useState<Report | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [savingName, setSavingName] = useState<string | null>(null);

  const N = STEPS.length;
  const done = wizard.stepIndex >= N;
  const pct = done ? 100 : Math.round(((wizard.stepIndex + 1) / N) * 100);

  function pick(stepId: string, value: string) {
    const newAnswers = { ...wizard.answers, [stepId]: value };
    if (stepId === 'pnrCoverage') {
      delete newAnswers.coverageSubtype;
      delete newAnswers.sideRule;
      delete newAnswers.middleRule;
    }
    const newIndex = wizard.stepIndex + 1;
    setWizard({
      answers: newAnswers,
      stepIndex: newIndex,
      history: [...wizard.history, { stepIndex: wizard.stepIndex, answers: wizard.answers }],
    });
    if (newIndex >= N) {
      const e = validateAll(newAnswers);
      if (e.length) { setErrors(e); setReport(null); }
      else { setErrors([]); setReport(buildReport(newAnswers)); }
    }
  }

  function back() {
    if (!wizard.history.length) return;
    const prev = wizard.history[wizard.history.length - 1];
    setWizard({ ...prev, history: wizard.history.slice(0, -1) });
    setReport(null); setErrors([]);
  }

  function restart() {
    setWizard({ answers: {}, stepIndex: 0, history: [] });
    setReport(null); setErrors([]); setSavingName(null);
  }

  function handleSave() {
    if (!report) return;
    setSavingName(report.name);
  }

  function confirmSave() {
    if (!report || savingName === null) return;
    const name = savingName.trim() || report.name;
    savePlan({
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
      report,
      answers: wizard.answers,
    });
    setSavingName(null);
    onSaved();
  }

  const step = STEPS[wizard.stepIndex];
  const opts = step?.id === 'coverageSubtype'
    ? (COV_SUBTYPE_OPTS[wizard.answers.pnrCoverage] ?? [])
    : step?.opts ?? [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Progress */}
      <div className="px-4 pb-3">
        <div className="flex justify-between text-[10px] font-semibold text-muted-foreground mb-1.5">
          <span>{done ? 'Completado' : `Paso ${wizard.stepIndex + 1} / ${N}`}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4">
        {done ? (
          <div className="space-y-3">
            {errors.length > 0 ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/8 p-4">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-destructive">Conflicto de viabilidad</p>
                </div>
                {errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive/80 leading-relaxed">{e}</p>
                ))}
              </div>
            ) : report ? (
              <ReportView report={report} onSave={handleSave} />
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-black text-foreground leading-snug">{step?.q}</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step?.h}</p>
            </div>
            <div className="space-y-2.5">
              {opts.map((o) => {
                const errMsg = step ? coverageViabilityError(step.id, o.v, wizard.answers) : null;
                return (
                  <button key={o.v} type="button" disabled={!!errMsg}
                    onClick={() => step && pick(step.id, o.v)}
                    className={cn(
                      'w-full text-left rounded-xl border-2 p-4 transition-all duration-100',
                      errMsg
                        ? 'border-border/30 bg-card/30 opacity-40 cursor-not-allowed'
                        : 'border-border bg-card hover:border-primary/60 hover:bg-primary/5 active:scale-[0.99]',
                    )}>
                    <p className="text-sm font-bold text-foreground leading-snug">{o.t}</p>
                    {o.d && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{o.d}</p>}
                    {errMsg && <p className="text-xs text-destructive mt-1.5 font-medium leading-relaxed">{errMsg}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Save name input — shown when saving */}
      {savingName !== null && (
        <div className="px-4 py-3 border-t border-border/40 bg-card space-y-2">
          <p className="text-xs font-bold text-foreground">Nombre del plan</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={savingName}
              onChange={e => setSavingName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') setSavingName(null); }}
              className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
              placeholder="Nombre del plan..."
              autoFocus
            />
            <button type="button" onClick={confirmSave}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors">
              Guardar
            </button>
            <button type="button" onClick={() => setSavingName(null)}
              className="h-10 px-3 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Nav buttons */}
      <div className="px-4 pb-4 pt-2 flex gap-2 border-t border-border/40">
        <button type="button" disabled={!wizard.history.length} onClick={back}
          className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors">
          Atrás
        </button>
        <button type="button" onClick={restart}
          className="flex items-center gap-1.5 px-4 h-11 rounded-xl border border-destructive/30 text-xs font-semibold text-destructive/70 hover:text-destructive hover:border-destructive/60 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
          Reiniciar
        </button>
      </div>
    </div>
  );
}

// ── PlaybookHub ───────────────────────────────────────────────────────────────

function PlaybookHub({ onNavigate, plans }: { onNavigate: (v: PlaybookView) => void; plans: SavedPlan[] }) {
  const sections = [
    {
      id: 'wizard-defensive' as PlaybookView,
      icon: Shield,
      label: 'Defensiva',
      count: plans.length,
      unit: plans.length === 1 ? 'plan' : 'planes',
      desc: 'Sistemas defensivos derivados del motor táctico.',
      color: 'text-blue-400',
      border: 'border-blue-400/20',
      bg: 'bg-blue-400/5',
      items: plans.slice(0, 3).map(p => ({ name: p.name, sub: p.report.anchor[0] ?? '' })),
      hasMore: plans.length > 3,
      extra: plans.length - 3,
    },
    {
      id: 'wizard-offensive' as PlaybookView,
      icon: Zap,
      label: 'Ofensiva',
      count: 0,
      unit: 'sets',
      desc: 'Jugadas base, acciones y principios de ataque.',
      color: 'text-amber-400',
      border: 'border-amber-400/20',
      bg: 'bg-amber-400/5',
      items: [],
      hasMore: false,
      extra: 0,
    },
    {
      id: 'wizard-atos' as PlaybookView,
      icon: BookOpen,
      label: 'ATOs',
      count: 0,
      unit: 'ATOs',
      desc: 'After timeout plays y end-of-game sequences.',
      color: 'text-emerald-400',
      border: 'border-emerald-400/20',
      bg: 'bg-emerald-400/5',
      items: [],
      hasMore: false,
      extra: 0,
    },
    {
      id: null,
      icon: Film,
      label: 'Film',
      count: 0,
      unit: 'vídeos',
      desc: 'Vídeos enlazados por concepto táctico.',
      color: 'text-purple-400',
      border: 'border-purple-400/20',
      bg: 'bg-purple-400/5',
      items: [],
      hasMore: false,
      extra: 0,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 space-y-3">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-2 py-2">
        {sections.map(s => (
          <div key={s.label} className="text-center">
            <p className={cn('text-xl font-black', s.color)}>{s.count}</p>
            <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cards */}
      {sections.map(s => {
        const Icon = s.icon;
        return (
          <div key={s.label} className={cn('rounded-xl border p-4 space-y-3', s.border, s.bg)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={cn('w-4 h-4', s.color)} />
                <span className="text-sm font-black text-foreground">{s.label}</span>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border', s.color, s.border)}>
                  {s.count} {s.unit}
                </span>
              </div>
              {s.id && (
                <button type="button" onClick={() => onNavigate(s.id!)}
                  className={cn(
                    'flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors',
                    s.color, s.border, 'hover:bg-white/5',
                  )}>
                  <Plus className="w-3 h-3" />
                  Nuevo
                </button>
              )}
            </div>

            {s.items.length > 0 ? (
              <div className="space-y-0">
                {s.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 border-t border-border/20 first:border-t-0">
                    <ChevronRight className={cn('w-3 h-3 shrink-0 mt-0.5', s.color)} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate leading-relaxed">{item.sub}</p>
                    </div>
                  </div>
                ))}
                {s.hasMore && (
                  <p className="text-[10px] text-muted-foreground pt-1.5 pl-5">+{s.extra} más</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Playbook ─────────────────────────────────────────────────────────────

export default function Playbook() {
  const { locale } = useLocale();
  const [view, setView] = useState<PlaybookView>('hub');
  const [plans, setPlans] = useState<SavedPlan[]>([]);

  useEffect(() => { setPlans(loadPlans()); }, []);

  function handleSaved() {
    setPlans(loadPlans());
    setView('hub');
  }

  const tagline =
    locale === 'zh' ? '球队战术与策略' :
    locale === 'es' ? 'Táctica y estrategia de equipo' :
    'Team tactics & strategy';

  const isWizard = view !== 'hub';

  const wizardLabel =
    view === 'wizard-defensive' ? 'Nuevo plan defensivo' :
    view === 'wizard-offensive' ? 'Nuevo set ofensivo' :
    'Nuevo ATO';

  const wizardIcon =
    view === 'wizard-defensive' ? <Shield className="w-4 h-4 text-blue-400" /> :
    view === 'wizard-offensive' ? <Zap className="w-4 h-4 text-amber-400" /> :
    <BookOpen className="w-4 h-4 text-emerald-400" />;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden md:pl-12 lg:pl-48">
      <main className="relative z-10 flex flex-col flex-1 min-h-0 max-w-2xl w-full mx-auto">
        <ModuleHeader module="playbook" tagline={tagline} />

        {/* Back button in wizard views */}
        {isWizard && (
          <button type="button" onClick={() => setView('hub')}
            className="flex items-center gap-1.5 mx-4 mb-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-fit">
            <ArrowLeft className="w-3.5 h-3.5" />
            Playbook
          </button>
        )}

        {/* Wizard header */}
        {isWizard && (
          <div className="flex items-center gap-2 px-4 pb-3">
            {wizardIcon}
            <span className="text-sm font-black text-foreground">{wizardLabel}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col flex-1 min-h-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {view === 'hub' && <PlaybookHub onNavigate={setView} plans={plans} />}
          {view === 'wizard-defensive' && <DefensiveSystemBuilder onSaved={handleSaved} />}
          {view === 'wizard-offensive' && (
            <ComingSoonWizard icon={Zap} title="Sistema ofensivo"
              desc="Diseño de jugadas, acciones base y principios de ataque compartidos — próximamente." />
          )}
          {view === 'wizard-atos' && (
            <ComingSoonWizard icon={BookOpen} title="ATOs"
              desc="After Timeout plays y end-of-game sequences — próximamente." />
          )}
        </div>
      </main>
      <ModuleNav />
    </div>
  );
}
