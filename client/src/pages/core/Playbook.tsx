import { useState, useEffect } from 'react';
import { Shield, Zap, Trophy, Flag, ChevronRight, RotateCcw, Plus, ArrowLeft, Save, Pencil, Loader2 } from 'lucide-react';
import { useCapabilities } from '@/lib/capabilities';
import {
  usePlans,
  useCreatePlan,
  useUpdatePlan,
  type PlaybookPlan,
} from '@/lib/playbook-api';
import { ModuleNav } from '@/pages/core/ModuleNav';
import { ModuleHeader } from '@/components/branding/ModuleHeader';
import { useLocale } from '@/lib/i18n';
import type { I18nKey } from '@/lib/i18n-core';
import { cn } from '@/lib/utils';
import {
  STEPS_DEF, COV_SUBTYPE_OPTS,
  KYP_ROLES, KYP_ACTIONS,
  getVisibleSteps, sectionForStep, stepLabel,
  getBlockReason, getWarnReason, buildReport,
  type Answers, type KypRule, type Report, type StepDef, type StepOption,
} from '@/lib/defensive-system';

type PlaybookView = 'hub' | 'defensa' | 'wizard-defensive' | 'review-defensive' | 'transicion' | 'ataque';

type PlanSavePayload = { name: string; answers: Answers; report: Report };

function planReport(plan: PlaybookPlan): Report {
  return plan.report as unknown as Report;
}

function fmt(t: (k: I18nKey) => string, key: I18nKey, vars: Record<string, string>): string {
  let s = t(key);
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}

interface WizardState {
  answers: Answers;
  stepIndex: number; // index into getVisibleSteps(answers)
  history: { stepIndex: number; answers: Answers }[];
}

function KypStep({ value, onChange }: {
  value: KypRule[];
  onChange: (rules: KypRule[]) => void;
}) {
  const { t } = useLocale();
  const rules = value || [];
  function addRule() {
    if (rules.length >= 5) return;
    onChange([...rules, { role: KYP_ROLES[0], action: KYP_ACTIONS[0] }]);
  }
  function removeRule(i: number) {
    onChange(rules.filter((_, idx) => idx !== i));
  }
  function updateRule(i: number, field: 'role' | 'action', v: string) {
    const next = [...rules];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  }
  return (
    <div className="space-y-3">
      {rules.map((rule, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2 relative">
          <button type="button" onClick={() => removeRule(i)}
            className="absolute top-2.5 right-2.5 text-[10px] text-destructive/60 hover:text-destructive transition-colors px-1.5 py-0.5 rounded border border-transparent hover:border-destructive/30">
            ✕
          </button>
          <div className="space-y-1.5 pr-6">
            <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400">{t('playbook_kyp_role')}</p>
            <select value={rule.role} onChange={e => updateRule(i, 'role', e.target.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 text-foreground focus:outline-none focus:border-primary">
              {KYP_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400">{t('playbook_kyp_rule')}</p>
            <select value={rule.action} onChange={e => updateRule(i, 'action', e.target.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 text-foreground focus:outline-none focus:border-primary">
              {KYP_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      ))}
      {rules.length < 5 && (
        <button type="button" onClick={addRule}
          className="w-full py-2.5 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors">
          {t('playbook_kyp_add')}
        </button>
      )}
    </div>
  );
}

function ReportChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-lg border p-2.5', highlight ? 'border-blue-400/25 bg-blue-400/5' : 'border-border bg-card/60')}>
      <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
      <p className={cn('text-xs font-bold leading-snug', highlight ? 'text-blue-400' : 'text-foreground')}>{value || '—'}</p>
    </div>
  );
}

function DefensivePlanReportContent({ report, t }: { report: Report; t: (k: I18nKey) => string }) {
  const tac = report.tac;
  const checks = report.checks;
  return (
    <>
      {checks.errors.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/6 p-3 space-y-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-destructive/70">{t('playbook_report_conflicts')}</p>
          {checks.errors.map((e, i) => <p key={i} className="text-xs text-destructive leading-relaxed">{e}</p>)}
        </div>
      )}
      {checks.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/6 p-3 space-y-1">
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-500/70">{t('playbook_report_warnings')}</p>
          {checks.warnings.map((w, i) => <p key={i} className="text-xs text-amber-500 leading-relaxed">{w}</p>)}
        </div>
      )}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <p className="text-[9px] font-black tracking-[2px] uppercase text-blue-400/70">{t('playbook_report_identity')}</p>
        <div className="grid grid-cols-2 gap-2">
          <ReportChip label="Priority" value={stepLabel('priority', report.answers.priority as string, report.answers)} highlight />
          <ReportChip label="Drive direction" value={stepLabel('driveDirection', report.answers.driveDirection as string, report.answers)} />
          <ReportChip label="On-ball" value={stepLabel('onBall', report.answers.onBall as string, report.answers)} />
          <ReportChip label="Pickup point" value={stepLabel('pickupPoint', report.answers.pickupPoint as string, report.answers)} />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <ReportChip label="Off-ball stance" value={tac.offBallStance} />
          <ReportChip label="Help-side anchor" value={tac.helpSideAnchor} />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <p className="text-[9px] font-black tracking-[2px] uppercase text-orange-400/70">{t('playbook_report_ballscreens')}</p>
        <div className="grid grid-cols-2 gap-2">
          <ReportChip label="PnR anchor" value={stepLabel('pnrCoverage', report.answers.pnrCoverage as string, report.answers)} highlight />
          <ReportChip label="Subtype" value={stepLabel('coverageSubtype', report.answers.coverageSubtype as string, report.answers)} />
          <ReportChip label="Side PnR" value={stepLabel('sideRule', report.answers.sideRule as string, report.answers)} />
          <ReportChip label="Middle PnR" value={stepLabel('middleRule', report.answers.middleRule as string, report.answers)} />
          <ReportChip label="DHO" value={stepLabel('dhoRule', report.answers.dhoRule as string, report.answers)} />
          <ReportChip label="Help" value={`${tac.helpStructure} / ${tac.helpTiming}`} />
        </div>
        {tac.nextCoverageSummary !== '—' && (
          <div className="pt-1">
            <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Next coverage</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{tac.nextCoverageSummary}</p>
          </div>
        )}
        {tac.popAnswerSummary !== '—' && (
          <div>
            <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Pop answer</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{tac.popAnswerSummary}</p>
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
        <p className="text-[9px] font-black tracking-[2px] uppercase text-primary/70">{t('playbook_report_derived')}</p>
        <div className="grid grid-cols-2 gap-2">
          <ReportChip label="Tag" value={tac.lowManTag} />
          <ReportChip label="Rotation" value={tac.rotationModel} />
          <ReportChip label="Penetration" value={tac.penetration} />
          <ReportChip label="Closeouts" value={tac.closeoutStyle} />
          <ReportChip label="Mismatch" value={tac.mismatchSummary} />
          <ReportChip label="Post" value={tac.postAnswer} />
        </div>
        {tac.rescramSummary !== '—' && (
          <div className="pt-1">
            <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Reswitch</p>
            <p className="text-xs text-foreground/80">{tac.rescramSummary}</p>
          </div>
        )}
      </div>
      {(report.answers.pinDownRule || report.answers.backScreenRule || report.answers.stagRule) && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-yellow-400/70">{t('playbook_report_offscreens')}</p>
          <div className="grid grid-cols-2 gap-2">
            {report.answers.pinDownRule && <ReportChip label="Pin-down" value={stepLabel('pinDownRule', report.answers.pinDownRule as string, report.answers)} />}
            {report.answers.backScreenRule && <ReportChip label="Back screen" value={stepLabel('backScreenRule', report.answers.backScreenRule as string, report.answers)} />}
            {report.answers.flareRule && <ReportChip label="Flare" value={stepLabel('flareRule', report.answers.flareRule as string, report.answers)} />}
            {report.answers.stagRule && <ReportChip label="Stagger" value={stepLabel('stagRule', report.answers.stagRule as string, report.answers)} />}
          </div>
        </div>
      )}
      {report.answers.earlyPnrCoverage && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-red-400/70">{t('playbook_report_early')}</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{tac.earlyPnrSummary}</p>
          {tac.earlyBigRole !== '—' && <p className="text-xs text-muted-foreground leading-relaxed">{tac.earlyBigRole}</p>}
        </div>
      )}
      {report.answers.spainCoverage && tac.spainSummary !== '—' && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-1.5">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-purple-400/70">{t('playbook_report_spain')}</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{tac.spainSummary}</p>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
        <p className="text-[9px] font-black tracking-[2px] uppercase text-blue-400/70">{t('playbook_report_transition')}</p>
        <p className="text-xs text-foreground/80 leading-relaxed">{tac.transitionDesc}</p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <ReportChip label="Rebote ofensivo" value={stepLabel('reboundBalance', report.answers.reboundBalance as string, report.answers)} />
          <ReportChip label="Prioridad" value={stepLabel('transitionPriority', report.answers.transitionPriority as string, report.answers)} />
        </div>
      </div>
      {tac.tradeoffs.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-primary/70">{t('playbook_report_tradeoffs')}</p>
          {tac.tradeoffs.map((line, i) => (
            <p key={i} className="text-xs text-foreground/75 leading-relaxed border-l-2 border-primary/20 pl-3">{line}</p>
          ))}
        </div>
      )}
      {(tac.personnelIssues.length > 0 || tac.personnelWarnings.length > 0) && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-primary/70">{t('playbook_report_personnel')}</p>
          {tac.personnelIssues.map((issue, i) => (
            <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
              <p className="text-[9px] font-bold text-destructive/80 mb-0.5">{issue.field}</p>
              <p className="text-xs text-destructive/70 leading-relaxed">{issue.detail}</p>
            </div>
          ))}
          {tac.personnelWarnings.map((w, i) => (
            <div key={i} className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5">
              <p className="text-[9px] font-bold text-amber-500/80 mb-0.5">{w.field}</p>
              <p className="text-xs text-amber-500/70 leading-relaxed">{w.detail}</p>
            </div>
          ))}
        </div>
      )}
      {(report.answers.kypRules as KypRule[])?.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-emerald-400/70">{t('playbook_report_kyp')}</p>
          {(report.answers.kypRules as KypRule[]).map((rule, i) => (
            <div key={i} className="rounded-lg border border-border p-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">{rule.role}</p>
              <p className="text-xs text-foreground/80">{rule.action}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function reviewSectionTitle(locale: string, es: string, en: string, zh: string): string {
  if (locale === 'zh') return zh;
  if (locale === 'es') return es;
  return en;
}

function DefensivePlanReview({
  plan,
  onBack,
  onEdit,
  onVisibilityChange,
  visibilityUpdating = false,
  readOnly = false,
}: {
  plan: PlaybookPlan;
  onBack: () => void;
  onEdit?: () => void;
  onVisibilityChange?: (visibility: PlaybookPlan['visibility']) => void;
  visibilityUpdating?: boolean;
  readOnly?: boolean;
}) {
  const { t, locale } = useLocale();
  const report = planReport(plan);
  const tac = report.tac;
  const dateStr = new Date(plan.createdAt).toLocaleDateString(
    locale === 'es' ? 'es-ES' : locale === 'zh' ? 'zh-CN' : 'en-US',
    { day: '2-digit', month: 'short', year: 'numeric' },
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 pb-4 space-y-4">
        <div>
          <p className="text-[9px] font-black tracking-[2px] uppercase text-emerald-500/60 mb-0.5">{t('playbook_report_generated')}</p>
          <h2 className="text-xl font-black text-foreground leading-tight">{plan.name}</h2>
          <p className="text-[11px] text-muted-foreground mt-1">{dateStr}</p>
        </div>

        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-primary/70 mb-1">{t('playbook_report_cognitive')}</p>
          <p className="text-sm font-bold text-foreground leading-snug">{tac.cognitiveRating}</p>
          <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
            {reviewSectionTitle(locale, 'Carga', 'Load', '负荷')}: {tac.cognitiveLoad}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-blue-400/70">
            {reviewSectionTitle(locale, 'Sistema base', 'Base system', '基础体系')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ReportChip label="Priority" value={stepLabel('priority', report.answers.priority as string, report.answers)} highlight />
            <ReportChip label="Drive direction" value={stepLabel('driveDirection', report.answers.driveDirection as string, report.answers)} />
            <ReportChip label="On-ball" value={stepLabel('onBall', report.answers.onBall as string, report.answers)} />
            <ReportChip label="Pickup point" value={stepLabel('pickupPoint', report.answers.pickupPoint as string, report.answers)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ReportChip label="Off-ball stance" value={tac.offBallStance} />
            <ReportChip label="Help-side anchor" value={tac.helpSideAnchor} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-orange-400/70">
            {reviewSectionTitle(locale, 'Cobertura PnR', 'PnR coverage', '挡拆防守')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ReportChip label="PnR anchor" value={stepLabel('pnrCoverage', report.answers.pnrCoverage as string, report.answers)} highlight />
            <ReportChip label="Subtype" value={stepLabel('coverageSubtype', report.answers.coverageSubtype as string, report.answers)} />
            <ReportChip label="Side PnR" value={stepLabel('sideRule', report.answers.sideRule as string, report.answers)} />
            <ReportChip label="Middle PnR" value={stepLabel('middleRule', report.answers.middleRule as string, report.answers)} />
            <ReportChip label="DHO" value={stepLabel('dhoRule', report.answers.dhoRule as string, report.answers)} />
          </div>
          {tac.nextCoverageSummary !== '—' && (
            <p className="text-xs text-foreground/80 leading-relaxed">{tac.nextCoverageSummary}</p>
          )}
          {tac.popAnswerSummary !== '—' && (
            <p className="text-xs text-foreground/80 leading-relaxed">{tac.popAnswerSummary}</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-cyan-400/70">
            {reviewSectionTitle(locale, 'Help Defense', 'Help defense', '协防体系')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <ReportChip label="Help structure" value={tac.helpStructure} />
            <ReportChip label="Help timing" value={tac.helpTiming} />
            <ReportChip label="Tag" value={tac.lowManTag} />
            <ReportChip label="Rotation" value={tac.rotationModel} />
            <ReportChip label="Penetration" value={tac.penetration} />
            <ReportChip label="Closeouts" value={tac.closeoutStyle} />
          </div>
        </div>

        {(report.answers.kypRules as KypRule[])?.length > 0 && (
          <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
            <p className="text-[9px] font-black tracking-[2px] uppercase text-emerald-400/70">{t('playbook_report_kyp')}</p>
            {(report.answers.kypRules as KypRule[]).map((rule, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">{rule.role}</p>
                <p className="text-xs text-foreground/80">{rule.action}</p>
              </div>
            ))}
          </div>
        )}

        {report.checks.errors.length > 0 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/6 p-3 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-wider text-destructive/70">{t('playbook_report_conflicts')}</p>
            {report.checks.errors.map((e, i) => <p key={i} className="text-xs text-destructive leading-relaxed">{e}</p>)}
          </div>
        )}
        {report.checks.warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/6 p-3 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-wider text-amber-500/70">{t('playbook_report_warnings')}</p>
            {report.checks.warnings.map((w, i) => <p key={i} className="text-xs text-amber-500 leading-relaxed">{w}</p>)}
          </div>
        )}

        {!readOnly && onVisibilityChange && (
          <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
            <p className="text-[9px] font-black tracking-[2px] uppercase text-muted-foreground/70">
              {reviewSectionTitle(locale, 'Visibilidad', 'Visibility', '可见性')}
            </p>
            <div className="flex flex-wrap gap-2">
              {([
                { v: 'draft' as const, label: reviewSectionTitle(locale, 'Borrador', 'Draft', '草稿'), color: 'border-border bg-muted/30 text-muted-foreground' },
                { v: 'staff' as const, label: 'Staff', color: 'border-blue-400/40 bg-blue-400/10 text-blue-400' },
                { v: 'players' as const, label: reviewSectionTitle(locale, 'Jugadoras', 'Players', '球员'), color: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400' },
              ]).map(({ v, label, color }) => (
                <button
                  key={v}
                  type="button"
                  disabled={visibilityUpdating}
                  onClick={() => onVisibilityChange(v)}
                  className={cn(
                    'h-8 px-3 rounded-full border text-[11px] font-bold transition-colors',
                    color,
                    plan.visibility === v && 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background',
                    visibilityUpdating && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pb-4 pt-3 flex gap-2 border-t border-border/40">
        <button type="button" onClick={onBack}
          className="h-10 px-5 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
          {reviewSectionTitle(locale, 'Volver', 'Back', '返回')}
        </button>
        {!readOnly && onEdit && (
          <button type="button" onClick={onEdit}
            className="flex items-center gap-1.5 h-10 px-4 rounded-lg border border-primary/40 bg-primary/8 text-primary text-xs font-bold hover:bg-primary/15 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
            {reviewSectionTitle(locale, 'Editar', 'Edit', '编辑')}
          </button>
        )}
      </div>
    </div>
  );
}

function DefensiveSystemBuilder({
  onSaved,
  initialPlan,
  savePending = false,
}: {
  onSaved: (data: PlanSavePayload) => void;
  initialPlan?: PlaybookPlan | null;
  savePending?: boolean;
}) {
  const { t } = useLocale();
  const [wizard, setWizard] = useState<WizardState>({ answers: {}, stepIndex: 0, history: [] });
  const [report, setReport] = useState<Report | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [kypDraft, setKypDraft] = useState<KypRule[]>([]);

  useEffect(() => {
    if (!initialPlan) return;
    const answers = initialPlan.answers as Answers;
    const visible = getVisibleSteps(answers);
    setWizard({ answers, stepIndex: visible.length, history: [] });
    setReport(buildReport(answers) as Report);
    setKypDraft((answers.kypRules as KypRule[]) || []);
  }, [initialPlan?.id]);

  const visibleSteps = getVisibleSteps(wizard.answers);
  const N = visibleSteps.length;
  const done = wizard.stepIndex >= N;
  const pct = done ? 100 : Math.round(((wizard.stepIndex + 1) / N) * 100);
  const step = visibleSteps[wizard.stepIndex] as StepDef | undefined;
  const section = step ? sectionForStep(step.id) : null;

  // Section progress dots
  const sectionSteps = section
    ? visibleSteps.filter(s => s.section === section.id)
    : [];
  const sectionStepIdx = step ? sectionSteps.findIndex(s => s.id === step.id) : -1;

  function advance(newAnswers: Answers) {
    const newVisible = getVisibleSteps(newAnswers);
    const newIndex = wizard.stepIndex + 1;
    setWizard({
      answers: newAnswers,
      stepIndex: newIndex,
      history: [...wizard.history, { stepIndex: wizard.stepIndex, answers: wizard.answers }],
    });
    if (newIndex >= newVisible.length) {
      setReport(buildReport(newAnswers) as Report);
    }
  }

  function pick(stepId: string, value: string) {
    const newAnswers = { ...wizard.answers, [stepId]: value };
    // Reset dependent steps when pnrCoverage changes
    if (stepId === 'pnrCoverage') {
      delete newAnswers.coverageSubtype;
      delete newAnswers.sideRule;
      delete newAnswers.middleRule;
      delete newAnswers.nextCoverage;
      delete newAnswers.popAnswer;
    }
    if (stepId === 'sideRule' && value !== 'ice') {
      delete newAnswers.iceCornerX3;
      delete newAnswers.iceSnake;
    }
    if (stepId === 'postDefense' && value !== 'dig') delete newAnswers.postDigger;
    if (stepId === 'postDefense' && value !== 'front' && value !== 'threeFront') delete newAnswers.postFront;
    advance(newAnswers);
  }

  function skip() {
    if (!step) return;
    const newAnswers = { ...wizard.answers };
    // Remove the key so it stays unset (skipped)
    delete newAnswers[step.id];
    advance(newAnswers);
  }

  function submitText(value: string) {
    if (!step) return;
    const newAnswers = value.trim()
      ? { ...wizard.answers, [step.id]: value.trim() }
      : { ...wizard.answers };
    if (!value.trim()) delete newAnswers[step.id];
    advance(newAnswers);
  }

  function submitKyp() {
    const newAnswers = { ...wizard.answers, kypRules: kypDraft };
    advance(newAnswers);
  }

  function back() {
    if (!wizard.history.length) return;
    const prev = wizard.history[wizard.history.length - 1];
    setWizard({ ...prev, history: wizard.history.slice(0, -1) });
    setReport(null); setSavingName(null);
  }

  function restart() {
    setWizard({ answers: {}, stepIndex: 0, history: [] });
    setReport(null); setSavingName(null); setKypDraft([]);
  }

  function handleSave() {
    if (!report) return;
    setSavingName(report.name);
  }

  function confirmSave() {
    if (!report || savingName === null || savePending) return;
    onSaved({
      name: savingName.trim() || report.name,
      answers: wizard.answers,
      report,
    });
    setSavingName(null);
  }

  // Text step state
  const [textValue, setTextValue] = useState('');

  const opts = step?.type === 'subtype'
    ? (COV_SUBTYPE_OPTS[(wizard.answers.pnrCoverage as keyof typeof COV_SUBTYPE_OPTS)] ?? [])
    : (step?.opts ?? []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Progress */}
      <div className="pb-4 space-y-2">
        <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-2">
            {section && (
              <span className="font-black uppercase tracking-wider" style={{ color: section.color }}>
                {section.label}
              </span>
            )}
            {!done && (
              <span className="text-muted-foreground/50">
                · {fmt(t, 'playbook_step_of', { current: String(wizard.stepIndex + 1), total: String(N) })}
              </span>
            )}
            {done && <span className="text-muted-foreground/50">{t('playbook_complete')}</span>}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%`, background: section ? section.color : 'hsl(var(--primary))' }} />
        </div>
        {/* Section dots */}
        {!done && sectionSteps.length > 1 && (
          <div className="flex gap-1.5">
            {sectionSteps.map((s, i) => (
              <div key={s.id} className="h-1 rounded-full transition-all duration-200"
                style={{
                  flex: 1,
                  background: i < sectionStepIdx ? section?.color : i === sectionStepIdx ? section?.color : 'hsl(var(--border))',
                  opacity: i === sectionStepIdx ? 1 : i < sectionStepIdx ? 0.5 : 0.25,
                }} />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-4">
        {done ? (
          // ── REPORT VIEW ──
          <div className="space-y-4">
            {report && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black tracking-[2px] uppercase text-emerald-500/60 mb-0.5">{t('playbook_report_generated')}</p>
                    <h3 className="text-xl font-black text-foreground leading-tight">{report.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{report.tac.cognitiveRating}</p>
                  </div>
                  <button type="button" onClick={handleSave} disabled={savePending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0 hover:bg-primary/90 transition-colors disabled:opacity-50">
                    <Save className="w-3.5 h-3.5" />
                    {t('playbook_save')}
                  </button>
                </div>
                <DefensivePlanReportContent report={report} t={t} />
              </>
            )}
          </div>
        ) : (
          // ── WIZARD STEP ──
          <div className="space-y-5 max-w-xl">
            <div>
              <h3 className="text-base font-black text-foreground leading-snug">{step?.q}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{step?.h}</p>
            </div>

            {/* TEXT STEP */}
            {step?.type === 'text' && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={textValue}
                  onChange={e => setTextValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitText(textValue); }}
                  placeholder={step.placeholder ?? ''}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-card text-sm font-semibold text-foreground focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50 placeholder:font-normal"
                  autoFocus
                />
                <button type="button" onClick={() => submitText(textValue)}
                  className="w-full h-11 rounded-xl border border-primary bg-primary/8 text-primary text-sm font-bold hover:bg-primary/15 transition-colors">
                  {textValue.trim() ? 'Continuar' : 'Saltar →'}
                </button>
              </div>
            )}

            {/* KYP STEP */}
            {step?.type === 'kyp' && (
              <div className="space-y-4">
                <KypStep value={kypDraft} onChange={setKypDraft} />
                <button type="button" onClick={submitKyp}
                  className="w-full h-11 rounded-xl border border-primary bg-primary/8 text-primary text-sm font-bold hover:bg-primary/15 transition-colors">
                  {kypDraft.length > 0
                    ? fmt(t, 'playbook_kyp_save', {
                        count: String(kypDraft.length),
                        plural: kypDraft.length > 1 ? 's' : '',
                      })
                    : t('playbook_skip_continue')}
                </button>
              </div>
            )}

            {/* OPTIONS STEP */}
            {(step?.type === 'options' || step?.type === 'subtype' || !step?.type) && (
              <div className="space-y-2">
                {opts.map((o: StepOption) => {
                  const block = step ? getBlockReason(step.id, o.v, wizard.answers) : null;
                  const warn  = (!block && step) ? getWarnReason(step.id, o.v, wizard.answers) : null;
                  return (
                    <button key={o.v} type="button" disabled={!!block}
                      onClick={() => step && pick(step.id, o.v)}
                      className={cn(
                        'w-full text-left rounded-xl border p-4 transition-all duration-100 group',
                        block ? 'border-border/20 bg-card/20 opacity-30 cursor-not-allowed'
                               : 'border-border bg-card hover:border-primary/50 hover:bg-primary/4 active:scale-[0.99] cursor-pointer',
                      )}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-foreground leading-snug">{o.t}</p>
                          {o.d && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{o.d}</p>}
                          {block && <p className="text-xs text-destructive mt-1.5 font-medium font-mono">{block}</p>}
                          {warn  && <p className="text-xs text-amber-500 mt-1.5 font-medium font-mono">{warn}</p>}
                        </div>
                        {!block && <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-0.5 group-hover:text-primary/50 transition-colors" />}
                      </div>
                    </button>
                  );
                })}

                {/* Skip button for skippable steps */}
                {step?.skippable && (
                  <button type="button" onClick={skip}
                    className="w-full py-2.5 text-xs font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                    {t('playbook_skip')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save name input */}
      {savingName !== null && (
        <div className="py-3 border-t border-border/50 bg-card/80 backdrop-blur space-y-2.5">
          <p className="text-xs font-bold text-foreground">{t('playbook_save_plan')}</p>
          <div className="flex gap-2 max-w-md">
            <input type="text" value={savingName} onChange={e => setSavingName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmSave(); if (e.key === 'Escape') setSavingName(null); }}
              className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder={t('playbook_save_name_placeholder')} autoFocus />
            <button type="button" onClick={confirmSave} disabled={savePending}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {savePending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('playbook_save')}
            </button>
            <button type="button" onClick={() => setSavingName(null)}
              className="h-10 px-3 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              {t('playbook_cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="pb-4 pt-3 flex gap-2 border-t border-border/40">
        <button type="button" disabled={!wizard.history.length} onClick={back}
          className="h-10 px-5 rounded-lg border border-border text-sm font-semibold text-muted-foreground disabled:opacity-25 hover:text-foreground hover:border-border/80 transition-colors">
          {t('playbook_back_btn')}
        </button>
        <button type="button" onClick={restart}
          className="flex items-center gap-1.5 h-10 px-4 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" />
          {t('playbook_restart')}
        </button>
      </div>
    </div>
  );
}

// ── Hub ─────────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { text: string; border: string; bg: string; dot: string }> = {
  blue:   { text: 'text-blue-400',   border: 'border-blue-400/20',   bg: 'bg-blue-400/4',   dot: 'bg-blue-400' },
  green:  { text: 'text-green-400',  border: 'border-green-400/20',  bg: 'bg-green-400/4',  dot: 'bg-green-400' },
  amber:  { text: 'text-amber-400',  border: 'border-amber-400/20',  bg: 'bg-amber-400/4',  dot: 'bg-amber-400' },
  purple: { text: 'text-purple-400', border: 'border-purple-400/20', bg: 'bg-purple-400/4', dot: 'bg-purple-400' },
};

type HubSectionDef = {
  id: 'defensa' | 'transicion' | 'ataque' | 'saques';
  view: PlaybookView | null;
  icon: typeof Shield;
  color: keyof typeof COLOR_MAP;
  getLabel: (locale: string) => string;
  getDesc: (locale: string) => string;
};

const HUB_SECTIONS: HubSectionDef[] = [
  {
    id: 'defensa', view: 'defensa', icon: Shield, color: 'blue',
    getLabel: (l) => l === 'zh' ? '防守' : 'Defensa',
    getDesc: (l) => l === 'zh' ? '防守战术体系和覆盖方案' : l === 'es' ? 'Sistema defensivo y coberturas' : 'Defensive system and coverages',
  },
  {
    id: 'transicion', view: 'transicion', icon: Zap, color: 'green',
    getLabel: (l) => l === 'zh' ? '转换' : 'Transición',
    getDesc: (l) => l === 'zh' ? '攻防转换原则' : l === 'es' ? 'Reglas de transición ofensiva y defensiva' : 'Offensive and defensive transition rules',
  },
  {
    id: 'ataque', view: 'ataque', icon: Trophy, color: 'amber',
    getLabel: (l) => l === 'zh' ? '进攻' : 'Ataque',
    getDesc: (l) => l === 'zh' ? '进攻战术体系和配合' : l === 'es' ? 'Sistemas ofensivos y conjuntos de jugadas' : 'Offensive systems and play sets',
  },
  {
    id: 'saques', view: null, icon: Flag, color: 'purple',
    getLabel: (l) => l === 'zh' ? '界外球' : 'Saques',
    getDesc: (l) => l === 'zh' ? '底线和边线界外球' : l === 'es' ? 'Jugadas de saque de fondo y banda' : 'Baseline and sideline inbound plays',
  },
];

// ── RuleCard ──────────────────────────────────────────────────────────────────

function RuleCard({ label, text, chips }: { label: string; text: string; chips?: string[] }) {
  if (!text || text === '—') return null;
  return (
    <div className="rounded-xl border border-border bg-card/50 p-3.5 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50 mt-0.5 shrink-0 leading-tight pt-px">
          {label}
        </span>
        <p className="text-sm font-semibold text-foreground leading-snug flex-1">{text}</p>
      </div>
      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map(chip => (
            <span key={chip} className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border/50 text-muted-foreground/60 bg-muted/20">
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PlaybookPlanReader ────────────────────────────────────────────────────────

function PlaybookPlanReader({ plan, onBack }: { plan: PlaybookPlan; onBack: () => void }) {
  const { locale } = useLocale();
  const report = planReport(plan);
  const tac = report.tac;
  const answers = report.answers;

  const es = locale === 'es'; const zh = locale === 'zh';
  const L = (e: string, en: string, z: string) => zh ? z : es ? e : en;

  const phaseRules: Array<{ phase: string; color: string; rules: Array<{ label: string; text: string; chips: string[] }> }> = [
    {
      phase: L('Transición defensiva', 'Defensive transition', '防守转换'),
      color: '#34d399',
      rules: [
        tac.transitionDesc && tac.transitionDesc !== '—' ? {
          label: L('PRINCIPIO', 'PRINCIPLE', '原则'),
          text: tac.transitionDesc,
          chips: [L('Transición', 'Transition', '转换')],
        } : null,
        answers.reboundBalance ? {
          label: L('REBOTE', 'REBOUND', '篮板'),
          text: stepLabel('reboundBalance', answers.reboundBalance as string, answers),
          chips: [L('Rebote', 'Rebound', '篮板')],
        } : null,
        answers.transitionPriority ? {
          label: L('PRIORIDAD', 'PRIORITY', '优先'),
          text: stepLabel('transitionPriority', answers.transitionPriority as string, answers),
          chips: [L('Transición', 'Transition', '转换')],
        } : null,
      ].filter(Boolean) as Array<{ label: string; text: string; chips: string[] }>,
    },
    {
      phase: L('Media cancha', 'Half-court defense', '半场防守'),
      color: '#60a5fa',
      rules: [
        answers.onBall ? {
          label: L('ON-BALL', 'ON-BALL', '持球防守'),
          text: [
            stepLabel('onBall', answers.onBall as string, answers),
            answers.driveDirection ? stepLabel('driveDirection', answers.driveDirection as string, answers) : null,
            answers.pickupPoint ? stepLabel('pickupPoint', answers.pickupPoint as string, answers) : null,
          ].filter(Boolean).join(' — '),
          chips: ['On-ball', L('Identidad', 'Identity', '体系')],
        } : null,
        (tac.offBallStance && tac.offBallStance !== '—') ? {
          label: L('SIN BALÓN', 'OFF-BALL', '无球防守'),
          text: tac.offBallStance + (tac.helpSideAnchor && tac.helpSideAnchor !== '—' ? ' — ' + tac.helpSideAnchor : ''),
          chips: ['Off-ball'],
        } : null,
        answers.pnrCoverage ? {
          label: 'PNR',
          text: [
            stepLabel('pnrCoverage', answers.pnrCoverage as string, answers),
            answers.coverageSubtype ? stepLabel('coverageSubtype', answers.coverageSubtype as string, answers) : null,
            tac.nextCoverageSummary && tac.nextCoverageSummary !== '—' ? tac.nextCoverageSummary : null,
          ].filter(Boolean).join(' — '),
          chips: ['PnR', L('Bloqueo', 'Screen', '挡拆')],
        } : null,
        answers.dhoRule ? {
          label: 'DHO',
          text: stepLabel('dhoRule', answers.dhoRule as string, answers),
          chips: ['DHO'],
        } : null,
        (tac.helpStructure && tac.helpStructure !== '—') ? {
          label: L('HELP', 'HELP', '协防'),
          text: [
            tac.helpStructure,
            tac.helpTiming && tac.helpTiming !== '—' ? tac.helpTiming : null,
            tac.lowManTag && tac.lowManTag !== '—' ? 'Tag: ' + tac.lowManTag : null,
          ].filter(Boolean).join(' — '),
          chips: [L('Help', 'Help', '协防'), L('Rotaciones', 'Rotation', '轮转')],
        } : null,
        (tac.rotationModel && tac.rotationModel !== '—') ? {
          label: L('ROTACIÓN', 'ROTATION', '轮转'),
          text: tac.rotationModel + (tac.penetration && tac.penetration !== '—' ? ' — ' + tac.penetration : ''),
          chips: [L('Rotaciones', 'Rotation', '轮转')],
        } : null,
        (tac.closeoutStyle && tac.closeoutStyle !== '—') ? {
          label: L('CIERRE', 'CLOSEOUT', '补防'),
          text: tac.closeoutStyle,
          chips: [L('Cierre', 'Closeout', '补防')],
        } : null,
        [answers.pinDownRule, answers.backScreenRule, answers.flareRule, answers.stagRule].some(Boolean) ? {
          label: L('PANTALLAS', 'SCREENS', '掩护'),
          text: [
            answers.pinDownRule ? 'Pin-down: ' + stepLabel('pinDownRule', answers.pinDownRule as string, answers) : null,
            answers.backScreenRule ? 'Back: ' + stepLabel('backScreenRule', answers.backScreenRule as string, answers) : null,
            answers.flareRule ? 'Flare: ' + stepLabel('flareRule', answers.flareRule as string, answers) : null,
            answers.stagRule ? 'Stagger: ' + stepLabel('stagRule', answers.stagRule as string, answers) : null,
          ].filter(Boolean).join(' · '),
          chips: [L('Pantallas', 'Screens', '掩护')],
        } : null,
        (tac.spainSummary && tac.spainSummary !== '—') ? {
          label: 'SPAIN PNR',
          text: tac.spainSummary,
          chips: ['Spain PnR'],
        } : null,
        (tac.earlyPnrSummary && tac.earlyPnrSummary !== '—') ? {
          label: 'EARLY PNR',
          text: tac.earlyPnrSummary,
          chips: ['Early PnR'],
        } : null,
      ].filter(Boolean) as Array<{ label: string; text: string; chips: string[] }>,
    },
    {
      phase: L('Situaciones especiales', 'Special situations', '特殊情况'),
      color: '#c084fc',
      rules: [
        (tac.postAnswer && tac.postAnswer !== '—') ? {
          label: 'POST',
          text: tac.postAnswer,
          chips: ['Post'],
        } : null,
        (tac.mismatchSummary && tac.mismatchSummary !== '—') ? {
          label: 'MISMATCH',
          text: tac.mismatchSummary,
          chips: ['Mismatch'],
        } : null,
        ...((answers.kypRules as KypRule[])?.map(rule => ({
          label: 'KYP',
          text: `${rule.role}: ${rule.action}`,
          chips: ['KYP', rule.role],
        })) ?? []),
      ].filter(Boolean) as Array<{ label: string; text: string; chips: string[] }>,
    },
  ];

  const dateStr = new Date(plan.createdAt).toLocaleDateString(
    locale === 'zh' ? 'zh-CN' : locale === 'es' ? 'es-ES' : 'en-US',
    { day: '2-digit', month: 'short', year: 'numeric' },
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 pb-4 space-y-5">
        {/* Header */}
        <div>
          <p className="text-[9px] font-black tracking-[2px] uppercase text-blue-400/60 mb-0.5">
            {L('Plan defensivo', 'Defensive plan', '防守计划')}
          </p>
          <h2 className="text-xl font-black text-foreground leading-tight">{plan.name}</h2>
          <p className="text-[11px] text-muted-foreground mt-1">{dateStr}</p>
        </div>

        {/* Cognitive rating */}
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5">
          <p className="text-[9px] font-black tracking-[2px] uppercase text-primary/70 mb-1">
            {L('Sistema', 'System', '体系')}
          </p>
          <p className="text-sm font-bold text-foreground leading-snug">{tac.cognitiveRating}</p>
        </div>

        {/* Phases */}
        {phaseRules.map(({ phase, color, rules }) => {
          if (rules.length === 0) return null;
          return (
            <div key={phase} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-[9px] font-black uppercase tracking-[3px] shrink-0" style={{ color }}>
                  {phase}
                </span>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              <div className="space-y-2.5">
                {rules.map((r, i) => (
                  <RuleCard key={i} label={r.label} text={r.text} chips={r.chips} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pb-4 pt-3 border-t border-border/40">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 h-10 px-5 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          {L('Volver', 'Back', '返回')}
        </button>
      </div>
    </div>
  );
}

// ── DefensaHub ────────────────────────────────────────────────────────────────

function DefensaHub({
  plans, onBack, onNewPlan, onSelectPlan, isPlayerUX,
}: {
  plans: PlaybookPlan[];
  onBack: () => void;
  onNewPlan: () => void;
  onSelectPlan: (plan: PlaybookPlan) => void;
  isPlayerUX: boolean;
}) {
  const { locale } = useLocale();
  const es = locale === 'es'; const zh = locale === 'zh';
  const L = (e: string, en: string, z: string) => zh ? z : es ? e : en;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-400/8 border border-blue-400/20 shrink-0">
              <Shield className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-foreground">{L('Defensa', 'Defense', '防守')}</h2>
              <p className="text-[11px] text-muted-foreground">
                {plans.length} {plans.length === 1 ? L('plan', 'plan', '计划') : L('planes', 'plans', '计划')}
              </p>
            </div>
          </div>
          {!isPlayerUX && (
            <button type="button" onClick={onNewPlan}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-blue-400/30 bg-blue-400/8 text-blue-400 text-xs font-bold hover:bg-blue-400/15 transition-colors shrink-0">
              <Plus className="w-3.5 h-3.5" />
              {L('Nuevo', 'New', '新建')}
            </button>
          )}
        </div>

        {/* Plan list or empty state */}
        {plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 flex flex-col items-center justify-center min-h-[220px] px-6 text-center">
            <Shield className="w-10 h-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-4">
              {isPlayerUX
                ? L('Tu cuerpo técnico aún no ha publicado planes defensivos', "Your coaching staff hasn't published defensive plans yet", '教练组尚未发布防守计划')
                : L('Crea el primer plan defensivo del equipo', 'Create the first defensive plan', '创建第一个防守计划')}
            </p>
            {!isPlayerUX && (
              <button type="button" onClick={onNewPlan}
                className="flex items-center gap-2 h-10 px-5 rounded-xl border border-blue-400/30 bg-blue-400/8 text-blue-400 text-sm font-bold hover:bg-blue-400/15 transition-colors">
                <Plus className="w-4 h-4" />
                {L('Nuevo plan', 'New plan', '新建计划')}
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="divide-y divide-border/30">
              {plans.map((plan) => {
                const pnr = stepLabel('pnrCoverage', planReport(plan).answers.pnrCoverage as string, planReport(plan).answers);
                const vis = plan.visibility;
                const badgeColor = vis === 'players'
                  ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30'
                  : vis === 'staff'
                  ? 'bg-blue-400/10 text-blue-400 border-blue-400/30'
                  : 'bg-muted/30 text-muted-foreground border-border';
                const badgeText = vis === 'players'
                  ? L('Publicado', 'Published', '已发布')
                  : vis === 'staff'
                  ? 'Staff'
                  : L('Borrador', 'Draft', '草稿');
                return (
                  <button key={plan.id} type="button" onClick={() => onSelectPlan(plan)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-card/60 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{plan.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{pnr}</p>
                    </div>
                    <span className={cn('text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0', badgeColor)}>
                      {badgeText}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0 tabular-nums">
                      {new Date(plan.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TransicionShell ───────────────────────────────────────────────────────────

function TransicionShell({ onBack, locale }: { onBack: () => void; locale: string }) {
  const [activeTab, setActiveTab] = useState<'defensiva' | 'ofensiva'>('defensiva');
  const es = locale === 'es'; const zh = locale === 'zh';
  const L = (e: string, en: string, z: string) => zh ? z : es ? e : en;
  const tabs = [
    { id: 'defensiva' as const, label: L('Defensiva', 'Defensive', '防守转换') },
    { id: 'ofensiva'  as const, label: L('Ofensiva',  'Offensive', '进攻转换') },
  ];
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-green-400/8 border border-green-400/20 shrink-0">
          <Zap className="w-4 h-4 text-green-400" />
        </div>
        <h2 className="text-lg font-black text-foreground">{L('Transición', 'Transition', '转换')}</h2>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-border mb-4 shrink-0">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={cn('flex-1 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors relative',
              activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70')}>
            {tab.label}
            {activeTab === tab.id && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-green-400 rounded-full" />}
          </button>
        ))}
      </div>
      {/* Placeholder */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col items-center justify-center min-h-[260px] gap-4 text-center px-6">
          <div className="w-14 h-14 rounded-2xl border border-green-400/20 bg-green-400/5 flex items-center justify-center">
            <Zap className="w-7 h-7 text-green-400/40" strokeWidth={1.5} />
          </div>
          <div>
            <span className="inline-block text-[9px] font-black tracking-[3px] uppercase text-muted-foreground/50 mb-2 border border-border rounded-full px-3 py-0.5">
              {L('Próximamente', 'Coming soon', '即将推出')}
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mt-2">
              {activeTab === 'defensiva'
                ? L('El cuerpo técnico está preparando las reglas de transición defensiva', 'Coaching staff is preparing defensive transition rules', '教练组正在准备防守转换规则')
                : L('El cuerpo técnico está preparando las reglas de transición ofensiva', 'Coaching staff is preparing offensive transition rules', '教练组正在准备进攻转换规则')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AtaqueShell ───────────────────────────────────────────────────────────────

function AtaqueShell({ onBack, locale }: { onBack: () => void; locale: string }) {
  const [activeTab, setActiveTab] = useState<'sistemas' | 'fondo' | 'banda'>('sistemas');
  const es = locale === 'es'; const zh = locale === 'zh';
  const L = (e: string, en: string, z: string) => zh ? z : es ? e : en;
  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'sistemas', label: L('Sistemas', 'Sets', '战术') },
    { id: 'fondo',    label: L('Saque fondo', 'Baseline', '底线') },
    { id: 'banda',    label: L('Saque banda', 'Sideline', '边线') },
  ];
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-400/8 border border-amber-400/20 shrink-0">
          <Trophy className="w-4 h-4 text-amber-400" />
        </div>
        <h2 className="text-lg font-black text-foreground">{L('Ataque', 'Offense', '进攻')}</h2>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-border mb-4 shrink-0">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={cn('flex-1 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors relative',
              activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70')}>
            {tab.label}
            {activeTab === tab.id && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-amber-400 rounded-full" />}
          </button>
        ))}
      </div>
      {/* Placeholder */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col items-center justify-center min-h-[260px] gap-4 text-center px-6">
          <div className="w-14 h-14 rounded-2xl border border-amber-400/20 bg-amber-400/5 flex items-center justify-center">
            <Trophy className="w-7 h-7 text-amber-400/40" strokeWidth={1.5} />
          </div>
          <div>
            <span className="inline-block text-[9px] font-black tracking-[3px] uppercase text-muted-foreground/50 mb-2 border border-border rounded-full px-3 py-0.5">
              {L('Próximamente', 'Coming soon', '即将推出')}
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mt-2">
              {activeTab === 'sistemas'
                ? L('El cuerpo técnico está preparando los sistemas ofensivos del equipo', 'Coaching staff is preparing team offensive systems', '教练组正在准备进攻战术体系')
                : activeTab === 'fondo'
                ? L('Jugadas de saque de fondo', 'Baseline inbound plays', '底线界外球配合')
                : L('Jugadas de saque de banda', 'Sideline inbound plays', '边线界外球配合')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PlaybookHub ───────────────────────────────────────────────────────────────

function PlaybookHub({
  plans, locale, onNavigate, isPlayerUX,
}: {
  plans: PlaybookPlan[];
  locale: string;
  onNavigate: (v: PlaybookView) => void;
  isPlayerUX: boolean;
}) {
  const es = locale === 'es'; const zh = locale === 'zh';
  const L = (e: string, en: string, z: string) => zh ? z : es ? e : en;

  function defMeta() {
    if (plans.length === 0) return { badge: null, lastUpdate: null, count: 0 };
    const published = plans.filter(p => p.visibility === 'players');
    const latest = plans[0];
    return {
      badge: published.length > 0
        ? { text: L('Publicado', 'Published', '已发布'), color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30' }
        : { text: L('Borrador', 'Draft', '草稿'), color: 'bg-muted/30 text-muted-foreground border-border' },
      lastUpdate: new Date(latest.createdAt).toLocaleDateString(
        zh ? 'zh-CN' : es ? 'es-ES' : 'en-US',
        { day: '2-digit', month: 'short', year: 'numeric' },
      ),
      count: plans.length,
    };
  }

  const defMeta_ = defMeta();

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="pb-6 space-y-3">
        {HUB_SECTIONS.map(section => {
          const Icon = section.icon;
          const c = COLOR_MAP[section.color];
          const isDisabled = !section.view;
          const label = section.getLabel(locale);
          const desc = section.getDesc(locale);
          const meta = section.id === 'defensa' ? defMeta_ : { badge: null, lastUpdate: null, count: 0 };

          return (
            <button
              key={section.id}
              type="button"
              disabled={isDisabled}
              onClick={() => section.view && onNavigate(section.view)}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-2xl border bg-card/20 transition-all text-left',
                isDisabled
                  ? 'border-border/40 opacity-50 cursor-not-allowed'
                  : 'border-border hover:bg-card/50 hover:border-border/80 active:scale-[0.99] cursor-pointer',
              )}
            >
              {/* Icon */}
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border', c.border, c.bg)}>
                <Icon className={cn('w-5 h-5', c.text)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-black text-foreground">{label}</p>
                  {meta.badge && (
                    <span className={cn('text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0', meta.badge.color)}>
                      {meta.badge.text}
                    </span>
                  )}
                  {isDisabled && (
                    <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-muted-foreground/50">
                      {L('Próximamente', 'Soon', '即将')}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                {meta.lastUpdate && (
                  <p className="text-[10px] text-muted-foreground/50 mt-1 tabular-nums">
                    {L('Actualizado', 'Updated', '更新')}: {meta.lastUpdate}
                    {' · '}
                    {meta.count} {meta.count === 1 ? L('plan', 'plan', '计划') : L('planes', 'plans', '计划')}
                  </p>
                )}
              </div>

              {/* Chevron */}
              {!isDisabled && <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── PlaybookPlayerView ────────────────────────────────────────────────────────

function PlaybookPlayerView({ plans, locale }: { plans: PlaybookPlan[]; locale: string }) {
  const [innerView, setInnerView] = useState<'hub' | 'defensa' | 'transicion' | 'ataque'>('hub');
  const [selected, setSelected] = useState<PlaybookPlan | null>(null);

  if (selected) {
    return <PlaybookPlanReader plan={selected} onBack={() => setSelected(null)} />;
  }
  if (innerView === 'defensa') {
    return (
      <DefensaHub
        plans={plans}
        onBack={() => setInnerView('hub')}
        onNewPlan={() => {}}
        onSelectPlan={(plan) => setSelected(plan)}
        isPlayerUX
      />
    );
  }
  if (innerView === 'transicion') return <TransicionShell onBack={() => setInnerView('hub')} locale={locale} />;
  if (innerView === 'ataque')    return <AtaqueShell    onBack={() => setInnerView('hub')} locale={locale} />;

  return (
    <PlaybookHub
      plans={plans}
      locale={locale}
      isPlayerUX
      onNavigate={(v) => {
        if (v === 'defensa') setInnerView('defensa');
        else if (v === 'transicion') setInnerView('transicion');
        else if (v === 'ataque') setInnerView('ataque');
      }}
    />
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Playbook() {
  const { t, locale } = useLocale();
  const caps = useCapabilities();
  const isPlayerUX = caps.canUsePlayerUX;
  const [view, setView] = useState<PlaybookView>('hub');
  const plansQ = usePlans('defensive');
  const plans = plansQ.data ?? [];
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const [selectedPlan, setSelectedPlan] = useState<PlaybookPlan | null>(null);
  const [editPlan, setEditPlan] = useState<PlaybookPlan | null>(null);
  const savePending = createPlan.isPending || updatePlan.isPending;

  useEffect(() => {
    if (!selectedPlan) return;
    const fresh = plans.find((p) => p.id === selectedPlan.id);
    if (fresh) setSelectedPlan(fresh);
  }, [plans, selectedPlan?.id]);

  async function handleSaved(data: PlanSavePayload) {
    try {
      if (editPlan) {
        await updatePlan.mutateAsync({
          id: editPlan.id,
          name: data.name,
          answers: data.answers as Record<string, unknown>,
          report: data.report as unknown as Record<string, unknown>,
        });
      } else {
        await createPlan.mutateAsync({
          type: 'defensive',
          name: data.name,
          answers: data.answers as Record<string, unknown>,
          report: data.report as unknown as Record<string, unknown>,
          visibility: 'draft',
        });
      }
      setEditPlan(null);
      setView('defensa');
    } catch { /* surfaced by query client */ }
  }

  function handleSelectPlan(plan: PlaybookPlan) {
    setSelectedPlan(plan);
    setView('review-defensive');
  }

  function handleEditPlan() {
    if (!selectedPlan) return;
    setEditPlan(selectedPlan);
    setSelectedPlan(null);
    setView('wizard-defensive');
  }

  const tagline = t('playbook_tagline');
  const es = locale === 'es'; const zh = locale === 'zh';
  const L = (e: string, en: string, z: string) => zh ? z : es ? e : en;

  const backLabel: Partial<Record<PlaybookView, string>> = {
    defensa: L('Inicio', 'Home', '主页'),
    transicion: L('Inicio', 'Home', '主页'),
    ataque: L('Inicio', 'Home', '主页'),
    'wizard-defensive': L('Defensa', 'Defense', '防守'),
    'review-defensive': L('Defensa', 'Defense', '防守'),
  };
  const pageTitle: Partial<Record<PlaybookView, string>> = {
    defensa: L('Defensa', 'Defense', '防守'),
    transicion: L('Transición', 'Transition', '转换'),
    ataque: L('Ataque', 'Offense', '进攻'),
    'wizard-defensive': L('Wizard Defensivo', 'Defensive wizard', '防守向导'),
    'review-defensive': L('Revisión', 'Review', '查看'),
  };

  function goBack() {
    if (view === 'wizard-defensive' || view === 'review-defensive') {
      setEditPlan(null); setSelectedPlan(null); setView('defensa');
    } else {
      setEditPlan(null); setSelectedPlan(null); setView('hub');
    }
  }

  if (isPlayerUX) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden pb-16 md:pb-0">
        <main className="relative z-10 flex flex-col flex-1 px-4 md:px-8 pb-6 max-w-5xl mx-auto w-full gap-3 overflow-y-auto min-h-0">
          <ModuleHeader module="playbook" tagline={tagline} />
          <div className="flex flex-col flex-1 min-h-0">
            {plansQ.isLoading
              ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              : <PlaybookPlayerView plans={plans} locale={locale} />}
          </div>
        </main>
        <ModuleNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden pb-16 md:pb-0">
      <main className="relative z-10 flex flex-col flex-1 px-4 md:px-8 pb-6 max-w-5xl mx-auto w-full gap-3 overflow-y-auto min-h-0">
        <ModuleHeader module="playbook" tagline={tagline} />

        {view !== 'hub' && (
          <div className="pb-3 flex items-center gap-3 flex-wrap">
            <button type="button" onClick={goBack}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              {backLabel[view] ?? L('Inicio', 'Home', '主页')}
            </button>
            <span className="text-muted-foreground/30 hidden sm:inline">/</span>
            <span className="text-xs font-black text-foreground">{pageTitle[view] ?? ''}</span>
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0">
          {plansQ.isLoading
            ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            : (
              <>
                {view === 'hub' && (
                  <PlaybookHub
                    plans={plans}
                    locale={locale}
                    isPlayerUX={false}
                    onNavigate={(v) => setView(v)}
                  />
                )}
                {view === 'defensa' && (
                  <DefensaHub
                    plans={plans}
                    onBack={() => setView('hub')}
                    onNewPlan={() => { setEditPlan(null); setView('wizard-defensive'); }}
                    onSelectPlan={handleSelectPlan}
                    isPlayerUX={false}
                  />
                )}
                {view === 'review-defensive' && selectedPlan && (
                  <DefensivePlanReview
                    plan={selectedPlan}
                    onBack={() => { setSelectedPlan(null); setView('defensa'); }}
                    onEdit={handleEditPlan}
                    onVisibilityChange={(visibility) =>
                      updatePlan.mutate({ id: selectedPlan.id, visibility })
                    }
                    visibilityUpdating={updatePlan.isPending}
                  />
                )}
                {view === 'wizard-defensive' && (
                  <DefensiveSystemBuilder
                    onSaved={handleSaved}
                    initialPlan={editPlan}
                    savePending={savePending}
                  />
                )}
                {view === 'transicion' && (
                  <TransicionShell onBack={() => setView('hub')} locale={locale} />
                )}
                {view === 'ataque' && (
                  <AtaqueShell onBack={() => setView('hub')} locale={locale} />
                )}
              </>
            )}
        </div>
      </main>
      <ModuleNav />
    </div>
  );
}
