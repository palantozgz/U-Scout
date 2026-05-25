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

type PlaybookView = 'hub' | 'wizard-defensive' | 'wizard-offensive' | 'wizard-atos';

interface SavedPlan {
  id: string;
  name: string;
  createdAt: string;
  report: Report;
  answers: Answers;
}

const STORAGE_KEY = 'playbook_defensive_plans';
function loadPlans(): SavedPlan[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function savePlan(plan: SavedPlan): void {
  const plans = loadPlans(); plans.unshift(plan);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.slice(0, 20)));
}

// ── Report components ─────────────────────────────────────────────────────────

function ReportSection({ title, items, type = 'list' }: { title: string; items: string[]; type?: 'list' | 'text' }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-[9px] font-black tracking-[2px] uppercase text-primary/60">{title}</h4>
      {type === 'text' ? (
        <p className="text-xs text-foreground/80 leading-relaxed">{items.join(' ')}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground/75 leading-relaxed">
              <ChevronRight className="w-3 h-3 text-primary/40 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportView({ report, onSave }: { report: Report; onSave?: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-black tracking-[2px] uppercase text-emerald-500/60 mb-0.5">Sistema generado</p>
            <h3 className="text-lg font-black text-foreground leading-tight">{report.name}</h3>
          </div>
        </div>
        {onSave && (
          <button type="button" onClick={onSave}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0 hover:bg-primary/90 transition-colors">
            <Save className="w-3.5 h-3.5" />
            Guardar plan
          </button>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-4">
        <ReportSection title="Identidad defensiva" items={[report.identity]} type="text" />
        <ReportSection title="Ancla" items={report.anchor} />
        <ReportSection title="Sistema derivado" items={report.derivedSystem} />
        <ReportSection title="Trade-offs" items={report.tradeOffs} />
        <ReportSection title="Fortalezas" items={report.st} />
        <ReportSection title="Debilidades" items={report.wk} />
        <ReportSection title="Transición" items={report.trans} />
        <ReportSection title="Rebote" items={report.reb} />
        <ReportSection title="Defensa temprana" items={report.early} type="text" />
        <ReportSection title="Uso ideal" items={report.us} />
        {report.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/6 p-3">
            <p className="text-[9px] font-black tracking-[2px] uppercase text-amber-500/60 mb-1.5">Avisos</p>
            {report.warnings.map((w, i) => <p key={i} className="text-xs text-amber-500 leading-relaxed">{w}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────

interface WizardState { answers: Answers; stepIndex: number; history: { stepIndex: number; answers: Answers }[]; }

function DefensiveSystemBuilder({ onSaved }: { onSaved: () => void }) {
  const [wizard, setWizard] = useState<WizardState>({ answers: {}, stepIndex: 0, history: [] });
  const [report, setReport] = useState<Report | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [savingName, setSavingName] = useState<string | null>(null);
  const N = STEPS.length;
  const done = wizard.stepIndex >= N;
  const pct = done ? 100 : Math.round(((wizard.stepIndex + 1) / N) * 100);

  function pick(stepId: string, value: string) {
    const na = { ...wizard.answers, [stepId]: value };
    if (stepId === 'pnrCoverage') { delete na.coverageSubtype; delete na.sideRule; delete na.middleRule; }
    const ni = wizard.stepIndex + 1;
    setWizard({ answers: na, stepIndex: ni, history: [...wizard.history, { stepIndex: wizard.stepIndex, answers: wizard.answers }] });
    if (ni >= N) { const e = validateAll(na); if (e.length) { setErrors(e); setReport(null); } else { setErrors([]); setReport(buildReport(na)); } }
  }
  function back() {
    if (!wizard.history.length) return;
    const prev = wizard.history[wizard.history.length - 1];
    setWizard({ ...prev, history: wizard.history.slice(0, -1) });
    setReport(null); setErrors([]);
  }
  function restart() { setWizard({ answers: {}, stepIndex: 0, history: [] }); setReport(null); setErrors([]); setSavingName(null); }
  function handleSave() { if (!report) return; setSavingName(report.name); }
  function confirmSave() {
    if (!report || savingName === null) return;
    savePlan({ id: Date.now().toString(), name: savingName.trim() || report.name, createdAt: new Date().toISOString(), report, answers: wizard.answers });
    setSavingName(null); onSaved();
  }

  const step = STEPS[wizard.stepIndex];
  const opts = step?.id === 'coverageSubtype' ? (COV_SUBTYPE_OPTS[wizard.answers.pnrCoverage] ?? []) : step?.opts ?? [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Progress */}
      <div className="pb-4">
        <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-2">
          <span>{done ? 'Completado' : `Paso ${wizard.stepIndex + 1} de ${N}`}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pb-4">
        {done ? (
          <div className="space-y-3 max-w-2xl">
            {errors.length > 0 ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/6 p-4">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-destructive">Conflicto de viabilidad</p>
                </div>
                {errors.map((e, i) => <p key={i} className="text-xs text-destructive/75 leading-relaxed">{e}</p>)}
              </div>
            ) : report ? <ReportView report={report} onSave={handleSave} /> : null}
          </div>
        ) : (
          <div className="space-y-5 max-w-xl">
            <div>
              <h3 className="text-base font-black text-foreground leading-snug">{step?.q}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{step?.h}</p>
            </div>
            <div className="space-y-2">
              {opts.map((o) => {
                const errMsg = step ? coverageViabilityError(step.id, o.v, wizard.answers) : null;
                return (
                  <button key={o.v} type="button" disabled={!!errMsg} onClick={() => step && pick(step.id, o.v)}
                    className={cn(
                      'w-full text-left rounded-xl border p-4 transition-all duration-100 group',
                      errMsg ? 'border-border/20 bg-card/20 opacity-35 cursor-not-allowed'
                             : 'border-border bg-card hover:border-primary/50 hover:bg-primary/4 active:scale-[0.99] cursor-pointer',
                    )}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground leading-snug">{o.t}</p>
                        {o.d && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{o.d}</p>}
                        {errMsg && <p className="text-xs text-destructive mt-1 font-medium">{errMsg}</p>}
                      </div>
                      {!errMsg && <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 group-hover:text-primary/50 transition-colors" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {savingName !== null && (
        <div className="py-3 border-t border-border/50 bg-card/80 backdrop-blur space-y-2.5">
          <p className="text-xs font-bold text-foreground">Nombre del plan</p>
          <div className="flex gap-2 max-w-md">
            <input type="text" value={savingName} onChange={e => setSavingName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') setSavingName(null); }}
              className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="Nombre del plan..." autoFocus />
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

      <div className="pb-4 pt-3 flex gap-2 border-t border-border/40">
        <button type="button" disabled={!wizard.history.length} onClick={back}
          className="h-10 px-5 rounded-lg border border-border text-sm font-semibold text-muted-foreground disabled:opacity-25 hover:text-foreground hover:border-border/80 transition-colors">
          Atrás
        </button>
        <button type="button" onClick={restart}
          className="flex items-center gap-1.5 h-10 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
          Reiniciar
        </button>
      </div>
    </div>
  );
}

function ComingSoonWizard({ icon: Icon, title, desc }: { icon: typeof Shield; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 pb-16 text-center px-6">
      <div className="w-14 h-14 rounded-2xl border border-border bg-card flex items-center justify-center">
        <Icon className="w-7 h-7 text-muted-foreground/50" strokeWidth={1.5} />
      </div>
      <div>
        <span className="inline-block text-[9px] font-black tracking-[3px] uppercase text-muted-foreground/50 mb-2 border border-border rounded-full px-3 py-0.5">EN DESARROLLO</span>
        <h2 className="text-lg font-black text-foreground mb-1.5">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{desc}</p>
      </div>
    </div>
  );
}

// ── Hub ───────────────────────────────────────────────────────────────────────

type HubSection = {
  id: PlaybookView | null;
  icon: typeof Shield;
  label: string;
  unit: (n: number) => string;
  color: keyof typeof COLOR_MAP;
  desc: string;
};

const HUB_SECTIONS: HubSection[] = [
  { id: 'wizard-defensive', icon: Shield,   label: 'Defensiva', unit: (n) => n === 1 ? 'plan' : 'planes',  color: 'blue',   desc: 'Sistemas defensivos derivados del motor táctico.' },
  { id: 'wizard-offensive', icon: Zap,      label: 'Ofensiva',  unit: () => 'sets',                                  color: 'amber',  desc: 'Jugadas base, acciones y principios de ataque.' },
  { id: 'wizard-atos',      icon: BookOpen, label: 'ATOs',      unit: (n) => n === 1 ? 'ATO' : 'ATOs',       color: 'emerald', desc: 'After timeout plays y end-of-game sequences.' },
  { id: null,               icon: Film,     label: 'Film',      unit: () => 'vídeos',                                color: 'purple', desc: 'Vídeos enlazados por concepto táctico.' },
];

const COLOR_MAP: Record<string, { text: string; border: string; bg: string; badge: string; dot: string }> = {
  blue:    { text: 'text-blue-400',    border: 'border-blue-400/20',    bg: 'bg-blue-400/4',    badge: 'bg-blue-400/10 text-blue-400 border-blue-400/25',    dot: 'bg-blue-400' },
  amber:   { text: 'text-amber-400',   border: 'border-amber-400/20',   bg: 'bg-amber-400/4',   badge: 'bg-amber-400/10 text-amber-400 border-amber-400/25',   dot: 'bg-amber-400' },
  emerald: { text: 'text-emerald-400', border: 'border-emerald-400/20', bg: 'bg-emerald-400/4', badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25', dot: 'bg-emerald-400' },
  purple:  { text: 'text-purple-400',  border: 'border-purple-400/20',  bg: 'bg-purple-400/4',  badge: 'bg-purple-400/10 text-purple-400 border-purple-400/25',  dot: 'bg-purple-400' },
};

function PlaybookHub({ onNavigate, plans }: { onNavigate: (v: PlaybookView) => void; plans: SavedPlan[] }) {
  const counts: Record<string, number> = { 'wizard-defensive': plans.length, 'wizard-offensive': 0, 'wizard-atos': 0 };

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="pb-6 space-y-6">

        {/* KPI bar */}
        <div className="grid grid-cols-4 gap-px bg-border/30 rounded-xl overflow-hidden border border-border/30">
          {HUB_SECTIONS.map(s => {
            const c = COLOR_MAP[s.color];
            const count = s.id ? (counts[s.id] ?? 0) : 0;
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                type="button"
                disabled={!s.id}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-5 bg-background transition-colors',
                  s.id ? 'cursor-pointer hover:bg-card/60' : 'cursor-default opacity-80',
                )}
                onClick={() => s.id && onNavigate(s.id)}
              >
                <Icon className={cn('w-3.5 h-3.5 mb-0.5', c.text)} />
                <span className={cn('text-3xl font-black tabular-nums leading-none', c.text)}>{count}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mt-1">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Cards grid — 2 cols on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HUB_SECTIONS.map(s => {
            const c = COLOR_MAP[s.color];
            const Icon = s.icon;
            const count = s.id ? (counts[s.id] ?? 0) : 0;
            const defensivePlans = s.id === 'wizard-defensive' ? plans.slice(0, 4) : [];

            return (
              <div key={s.label} className={cn('rounded-2xl border flex flex-col overflow-hidden bg-card/20', c.border)}>
                {/* Card header */}
                <div className={cn('flex items-center justify-between px-5 py-4 border-b border-border/20', c.bg)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center border shrink-0', c.border, 'bg-background/50')}>
                      <Icon className={cn('w-4 h-4', c.text)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-foreground leading-tight">{s.label}</p>
                      <p className={cn('text-[11px] font-semibold tabular-nums', c.text)}>{count} {s.unit(count)}</p>
                    </div>
                  </div>
                  {s.id && (
                    <button type="button" onClick={() => onNavigate(s.id!)}
                      className={cn(
                        'flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-[11px] font-bold shrink-0 ml-3 transition-all',
                        c.border, c.text, 'bg-background/40',
                        'hover:brightness-125 active:scale-95',
                      )}>
                      <Plus className="w-3.5 h-3.5" />
                      Nuevo
                    </button>
                  )}
                </div>

                {/* Card body */}
                <div className="flex-1 px-5 py-3 min-h-[88px]">
                  {defensivePlans.length > 0 ? (
                    <div className="space-y-0">
                      {defensivePlans.map((plan) => (
                        <div key={plan.id} className="flex items-center gap-3 py-2.5 border-b border-border/15 last:border-0">
                          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.dot)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground truncate">{plan.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{plan.report.anchor[0] ?? ''}</p>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground/45 shrink-0 tabular-nums">
                            {new Date(plan.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      ))}
                      {plans.length > 4 && (
                        <p className="text-[10px] text-muted-foreground/50 py-2 pl-4">+{plans.length - 4} planes más</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center min-h-[72px]">
                      <p className="text-xs text-muted-foreground/55 text-center leading-relaxed px-2">{s.desc}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Wizard labels ─────────────────────────────────────────────────────────────

const WIZARD_META: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  'wizard-defensive': { label: 'Nuevo plan defensivo', icon: Shield,   color: 'text-blue-400' },
  'wizard-offensive': { label: 'Nuevo set ofensivo',   icon: Zap,      color: 'text-amber-400' },
  'wizard-atos':      { label: 'Nuevo ATO',            icon: BookOpen, color: 'text-emerald-400' },
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Playbook() {
  const { locale } = useLocale();
  const [view, setView] = useState<PlaybookView>('hub');
  const [plans, setPlans] = useState<SavedPlan[]>([]);

  useEffect(() => { setPlans(loadPlans()); }, []);

  function handleSaved() { setPlans(loadPlans()); setView('hub'); }

  const tagline =
    locale === 'zh' ? '球队战术与策略' :
    locale === 'es' ? 'Táctica y estrategia de equipo' :
    'Team tactics & strategy';

  const isWizard = view !== 'hub';
  const meta = isWizard ? WIZARD_META[view] : null;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden pb-16 md:pb-0">
      <main className="relative z-10 flex flex-col flex-1 px-4 md:px-8 pb-6 max-w-5xl mx-auto w-full gap-3 overflow-y-auto min-h-0">
        <ModuleHeader module="playbook" tagline={tagline} />

        {/* Wizard back + title */}
        {isWizard && meta && (
          <div className="pb-3 flex items-center gap-3 flex-wrap">
            <button type="button" onClick={() => setView('hub')}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Playbook
            </button>
            <span className="text-muted-foreground/30 hidden sm:inline">/</span>
            <div className="flex items-center gap-1.5">
              <meta.icon className={cn('w-3.5 h-3.5', meta.color)} />
              <span className="text-xs font-black text-foreground">{meta.label}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0">
          {view === 'hub'               && <PlaybookHub onNavigate={setView} plans={plans} />}
          {view === 'wizard-defensive'  && <DefensiveSystemBuilder onSaved={handleSaved} />}
          {view === 'wizard-offensive'  && <ComingSoonWizard icon={Zap}      title="Sistema ofensivo" desc="Diseño de jugadas, acciones base y principios de ataque — próximamente." />}
          {view === 'wizard-atos'       && <ComingSoonWizard icon={BookOpen} title="ATOs"             desc="After Timeout plays y end-of-game sequences — próximamente." />}
        </div>
      </main>
      <ModuleNav />
    </div>
  );
}
