import { useState } from 'react';
import { Shield, Zap, BookOpen, ChevronRight, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { ModuleNav } from '@/pages/core/ModuleNav';
import { ModuleHeader } from '@/components/branding/ModuleHeader';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  STEPS, COV_SUBTYPE_OPTS,
  coverageViabilityError, validateAll, buildReport,
  type Answers, type Report,
} from '@/lib/defensive-system';

type PlaybookTab = 'defensive' | 'offensive' | 'atos';

const TABS = [
  { id: 'defensive' as PlaybookTab, label: 'Defensiva', icon: Shield },
  { id: 'offensive' as PlaybookTab, label: 'Ofensiva', icon: Zap },
  { id: 'atos' as PlaybookTab, label: 'ATOs', icon: BookOpen },
];

function ComingSoonTab({ icon: Icon, title, desc }: { icon: typeof Shield; title: string; desc: string }) {
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

interface WizardState {
  answers: Answers;
  stepIndex: number;
  history: { stepIndex: number; answers: Answers }[];
}

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

function ReportView({ report }: { report: Report }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[9px] font-black tracking-[2px] uppercase text-emerald-500/70 mb-0.5">Sistema generado</p>
          <h3 className="text-lg font-black text-foreground leading-tight">{report.name}</h3>
        </div>
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
            {report.warnings.map((w, i) => <p key={i} className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{w}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

function DefensiveSystemBuilder() {
  const [wizard, setWizard] = useState<WizardState>({ answers: {}, stepIndex: 0, history: [] });
  const [report, setReport] = useState<Report | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const N = STEPS.length;
  const done = wizard.stepIndex >= N;
  const pct = done ? 100 : Math.round(((wizard.stepIndex + 1) / N) * 100);

  function pick(stepId: string, value: string) {
    const newAnswers = { ...wizard.answers, [stepId]: value };
    if (stepId === 'pnrCoverage') { delete newAnswers.coverageSubtype; delete newAnswers.sideRule; delete newAnswers.middleRule; }
    const newIndex = wizard.stepIndex + 1;
    setWizard({ answers: newAnswers, stepIndex: newIndex, history: [...wizard.history, { stepIndex: wizard.stepIndex, answers: wizard.answers }] });
    if (newIndex >= N) {
      const e = validateAll(newAnswers);
      if (e.length) { setErrors(e); setReport(null); } else { setErrors([]); setReport(buildReport(newAnswers)); }
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
    setReport(null); setErrors([]);
  }

  const step = STEPS[wizard.stepIndex];
  const opts = step?.id === 'coverageSubtype' ? (COV_SUBTYPE_OPTS[wizard.answers.pnrCoverage] ?? []) : step?.opts ?? [];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 pb-3">
        <div className="flex justify-between text-[10px] font-semibold text-muted-foreground mb-1.5">
          <span>{done ? 'Completado' : `Paso ${wizard.stepIndex + 1} / ${N}`}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4">
        {done ? (
          <div className="space-y-3">
            {errors.length > 0 ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/8 p-4">
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-destructive">Conflicto de viabilidad</p>
                </div>
                {errors.map((e, i) => <p key={i} className="text-xs text-destructive/80 leading-relaxed">{e}</p>)}
              </div>
            ) : report ? <ReportView report={report} /> : null}
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
                  <button key={o.v} type="button" disabled={!!errMsg} onClick={() => step && pick(step.id, o.v)}
                    className={cn('w-full text-left rounded-xl border-2 p-4 transition-all duration-100',
                      errMsg ? 'border-border/30 bg-card/30 opacity-40 cursor-not-allowed'
                             : 'border-border bg-card hover:border-primary/60 hover:bg-primary/5 active:scale-[0.99]')}>
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

export default function Playbook() {
  const { locale } = useLocale();
  const [activeTab, setActiveTab] = useState<PlaybookTab>('defensive');
  const tagline = locale === 'zh' ? '球队战术与策略' : locale === 'es' ? 'Táctica y estrategia de equipo' : 'Team tactics & strategy';

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden md:pl-12 lg:pl-48">
      <main className="relative z-10 flex flex-col flex-1 min-h-0 max-w-2xl w-full mx-auto">
        <ModuleHeader module="playbook" tagline={tagline} />
        <div className="flex gap-1 px-4 pb-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors',
                  active ? 'bg-primary/10 text-primary border border-primary/30'
                         : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent')}>
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col flex-1 min-h-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {activeTab === 'defensive' && <DefensiveSystemBuilder />}
          {activeTab === 'offensive' && <ComingSoonTab icon={Zap} title="Sistema ofensivo" desc="Diseño de jugadas, acciones base y principios de ataque compartidos — próximamente." />}
          {activeTab === 'atos' && <ComingSoonTab icon={BookOpen} title="ATOs" desc="After Timeout plays y end-of-game sequences — próximamente." />}
        </div>
      </main>
      <ModuleNav />
    </div>
  );
}
