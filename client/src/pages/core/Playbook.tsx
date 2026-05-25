import { useState, useEffect } from 'react';
import { Shield, Zap, BookOpen, Film, ChevronRight, RotateCcw, Plus, ArrowLeft, Save } from 'lucide-react';
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

function DefensiveSystemBuilder({ onSaved }: { onSaved: () => void }) {
  const { t } = useLocale();
  const [wizard, setWizard] = useState<WizardState>({ answers: {}, stepIndex: 0, history: [] });
  const [report, setReport] = useState<Report | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [kypDraft, setKypDraft] = useState<KypRule[]>([]);

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
    if (!report || savingName === null) return;
    savePlan({
      id: Date.now().toString(),
      name: savingName.trim() || report.name,
      createdAt: new Date().toISOString(),
      report,
      answers: wizard.answers,
    });
    setSavingName(null);
    onSaved();
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
            {report && (() => {
              const tac = report.tac;
              const checks = report.checks;
              return (
                <>
                  {/* Name bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black tracking-[2px] uppercase text-emerald-500/60 mb-0.5">{t('playbook_report_generated')}</p>
                      <h3 className="text-xl font-black text-foreground leading-tight">{report.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{tac.cognitiveRating}</p>
                    </div>
                    <button type="button" onClick={handleSave}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0 hover:bg-primary/90 transition-colors">
                      <Save className="w-3.5 h-3.5" />
                      {t('playbook_save')}
                    </button>
                  </div>

                  {/* Errors / warnings */}
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

                  {/* Identity */}
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

                  {/* Ball screens */}
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

                  {/* Derived system */}
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

                  {/* Off-ball screens (if answered) */}
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

                  {/* Early offense (if answered) */}
                  {report.answers.earlyPnrCoverage && (
                    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
                      <p className="text-[9px] font-black tracking-[2px] uppercase text-red-400/70">{t('playbook_report_early')}</p>
                      <p className="text-xs text-foreground/80 leading-relaxed">{tac.earlyPnrSummary}</p>
                      {tac.earlyBigRole !== '—' && <p className="text-xs text-muted-foreground leading-relaxed">{tac.earlyBigRole}</p>}
                    </div>
                  )}

                  {/* Spain PnR (if answered) */}
                  {report.answers.spainCoverage && tac.spainSummary !== '—' && (
                    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-1.5">
                      <p className="text-[9px] font-black tracking-[2px] uppercase text-purple-400/70">{t('playbook_report_spain')}</p>
                      <p className="text-xs text-foreground/80 leading-relaxed">{tac.spainSummary}</p>
                    </div>
                  )}

                  {/* Transition */}
                  <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
                    <p className="text-[9px] font-black tracking-[2px] uppercase text-blue-400/70">{t('playbook_report_transition')}</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{tac.transitionDesc}</p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <ReportChip label="Rebote ofensivo" value={stepLabel('reboundBalance', report.answers.reboundBalance as string, report.answers)} />
                      <ReportChip label="Prioridad" value={stepLabel('transitionPriority', report.answers.transitionPriority as string, report.answers)} />
                    </div>
                  </div>

                  {/* Trade-offs */}
                  {tac.tradeoffs.length > 0 && (
                    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
                      <p className="text-[9px] font-black tracking-[2px] uppercase text-primary/70">{t('playbook_report_tradeoffs')}</p>
                      {tac.tradeoffs.map((t, i) => (
                        <p key={i} className="text-xs text-foreground/75 leading-relaxed border-l-2 border-primary/20 pl-3">{t}</p>
                      ))}
                    </div>
                  )}

                  {/* Personnel analysis */}
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

                  {/* KYP Rules */}
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
            })()}
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
            <button type="button" onClick={confirmSave}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors">
              {t('playbook_save')}
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

function ComingSoonWizard({ icon: Icon, title, desc }: { icon: typeof Shield; title: string; desc: string }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 pb-16 text-center px-6">
      <div className="w-14 h-14 rounded-2xl border border-border bg-card flex items-center justify-center">
        <Icon className="w-7 h-7 text-muted-foreground/50" strokeWidth={1.5} />
      </div>
      <div>
        <span className="inline-block text-[9px] font-black tracking-[3px] uppercase text-muted-foreground/50 mb-2 border border-border rounded-full px-3 py-0.5">{t('playbook_hub_coming_soon')}</span>
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
  color: keyof typeof COLOR_MAP;
  descKey: I18nKey;
  unitKey: I18nKey;
  unitKeyOne?: I18nKey;
};

const HUB_SECTIONS: HubSection[] = [
  { id: 'wizard-defensive', icon: Shield,   label: 'Defensiva', color: 'blue',   descKey: 'playbook_hub_desc_defensive', unitKey: 'playbook_unit_planes', unitKeyOne: 'playbook_unit_plan' },
  { id: 'wizard-offensive', icon: Zap,      label: 'Ofensiva',  color: 'amber',  descKey: 'playbook_hub_desc_offensive', unitKey: 'playbook_unit_sets' },
  { id: 'wizard-atos',      icon: BookOpen, label: 'ATOs',      color: 'emerald', descKey: 'playbook_hub_desc_atos', unitKey: 'playbook_unit_atos' },
  { id: null,               icon: Film,     label: 'Film',      color: 'purple', descKey: 'playbook_hub_desc_film', unitKey: 'playbook_unit_videos' },
];

function hubUnitLabel(t: (k: I18nKey) => string, s: HubSection, count: number): string {
  const key = s.unitKeyOne && count === 1 ? s.unitKeyOne : s.unitKey;
  return fmt(t, key, { count: String(count) });
}

const COLOR_MAP: Record<string, { text: string; border: string; bg: string; badge: string; dot: string }> = {
  blue:    { text: 'text-blue-400',    border: 'border-blue-400/20',    bg: 'bg-blue-400/4',    badge: 'bg-blue-400/10 text-blue-400 border-blue-400/25',    dot: 'bg-blue-400' },
  amber:   { text: 'text-amber-400',   border: 'border-amber-400/20',   bg: 'bg-amber-400/4',   badge: 'bg-amber-400/10 text-amber-400 border-amber-400/25',   dot: 'bg-amber-400' },
  emerald: { text: 'text-emerald-400', border: 'border-emerald-400/20', bg: 'bg-emerald-400/4', badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25', dot: 'bg-emerald-400' },
  purple:  { text: 'text-purple-400',  border: 'border-purple-400/20',  bg: 'bg-purple-400/4',  badge: 'bg-purple-400/10 text-purple-400 border-purple-400/25',  dot: 'bg-purple-400' },
};

function PlaybookHub({ onNavigate, plans }: { onNavigate: (v: PlaybookView) => void; plans: SavedPlan[] }) {
  const { t } = useLocale();
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
                      <p className={cn('text-[11px] font-semibold tabular-nums', c.text)}>{hubUnitLabel(t, s, count)}</p>
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
                      {t('playbook_hub_new')}
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
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{stepLabel('pnrCoverage', plan.report.answers.pnrCoverage as string, plan.report.answers)}</p>
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
                      <p className="text-xs text-muted-foreground/55 text-center leading-relaxed px-2">{t(s.descKey)}</p>
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Playbook() {
  const { t } = useLocale();
  const [view, setView] = useState<PlaybookView>('hub');
  const [plans, setPlans] = useState<SavedPlan[]>([]);

  useEffect(() => { setPlans(loadPlans()); }, []);

  function handleSaved() { setPlans(loadPlans()); setView('hub'); }

  const tagline = t('playbook_tagline');

  const isWizard = view !== 'hub';
  const wizardMeta = isWizard ? {
    'wizard-defensive': { label: t('playbook_wizard_defensive'), icon: Shield, color: 'text-blue-400' },
    'wizard-offensive': { label: t('playbook_wizard_offensive'), icon: Zap, color: 'text-amber-400' },
    'wizard-atos':      { label: t('playbook_wizard_atos'), icon: BookOpen, color: 'text-emerald-400' },
  }[view] : null;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden pb-16 md:pb-0">
      <main className="relative z-10 flex flex-col flex-1 px-4 md:px-8 pb-6 max-w-5xl mx-auto w-full gap-3 overflow-y-auto min-h-0">
        <ModuleHeader module="playbook" tagline={tagline} />

        {/* Wizard back + title */}
        {isWizard && wizardMeta && (
          <div className="pb-3 flex items-center gap-3 flex-wrap">
            <button type="button" onClick={() => setView('hub')}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('playbook_back')}
            </button>
            <span className="text-muted-foreground/30 hidden sm:inline">/</span>
            <div className="flex items-center gap-1.5">
              <wizardMeta.icon className={cn('w-3.5 h-3.5', wizardMeta.color)} />
              <span className="text-xs font-black text-foreground">{wizardMeta.label}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0">
          {view === 'hub'               && <PlaybookHub onNavigate={setView} plans={plans} />}
          {view === 'wizard-defensive'  && <DefensiveSystemBuilder onSaved={handleSaved} />}
          {view === 'wizard-offensive'  && <ComingSoonWizard icon={Zap}      title={t('playbook_offensive_title')} desc={t('playbook_offensive_desc')} />}
          {view === 'wizard-atos'       && <ComingSoonWizard icon={BookOpen} title={t('playbook_atos_title')} desc={t('playbook_atos_desc')} />}
        </div>
      </main>
      <ModuleNav />
    </div>
  );
}
