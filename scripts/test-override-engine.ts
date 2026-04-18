import {
  applyOverrides,
  detectDiscrepancies,
  detectPatterns,
  buildOverrideRecord,
} from "../client/src/lib/overrideEngine";
import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { renderReport } from "../client/src/lib/reportTextRenderer";
import testProfiles from "./test-profiles.json";

const luka = (testProfiles as any[])[0];
const motor = generateMotorV4(luka.inputs, luka.clubContext);
const rendered = renderReport(motor, { locale: "es", gender: "m" });

let passed = 0;
let failed = 0;
const errors: string[] = [];

function check(name: string, condition: boolean) {
  if (condition) {
    passed++;
  } else {
    failed++;
    errors.push(`FAIL: ${name}`);
  }
}

const overrideReplace: any = {
  playerId: "p1",
  coachId: "c1",
  slide: "defense",
  itemKey: "deny.instruction",
  action: "replace",
  replacementValue: "Instrucción personalizada del entrenador",
};
const withReplace = applyOverrides(rendered, [overrideReplace]);
check(
  "replace deny instruction",
  withReplace.defense.deny.instruction ===
    "Instrucción personalizada del entrenador",
);
check(
  "original not mutated after replace",
  rendered.defense.deny.instruction !==
    "Instrucción personalizada del entrenador",
);

const originalSituationCount = rendered.situations.length;
const overrideHide: any = {
  playerId: "p1",
  coachId: "c1",
  slide: "situations",
  itemKey: "situations.0",
  action: "hide",
};
const withHide = applyOverrides(rendered, [overrideHide]);
check(
  "hide situation reduces count",
  withHide.situations.length === originalSituationCount - 1,
);
check(
  "original not mutated after hide",
  rendered.situations.length === originalSituationCount,
);

const firstAlt = rendered.defense.deny.alternatives[0]?.instruction;
const overrideHideDeny: any = {
  playerId: "p1",
  coachId: "c1",
  slide: "defense",
  itemKey: "deny.instruction",
  action: "hide",
};
const withHideDeny = applyOverrides(rendered, [overrideHideDeny]);
if (firstAlt) {
  check(
    "hide deny falls back to alternative",
    withHideDeny.defense.deny.instruction === firstAlt,
  );
}

const overrideApprove: any = {
  playerId: "p1",
  coachId: "c1",
  slide: "defense",
  itemKey: "deny.instruction",
  action: "approve_as_is",
};
const withApprove = applyOverrides(rendered, [overrideApprove]);
check(
  "approve_as_is does not modify report",
  withApprove.defense.deny.instruction === rendered.defense.deny.instruction,
);

const overridesA: any[] = [
  {
    playerId: "p1",
    coachId: "c1",
    slide: "defense",
    itemKey: "deny.instruction",
    action: "replace",
    replacementValue: "Versión A",
  },
];
const overridesB: any[] = [
  {
    playerId: "p1",
    coachId: "c2",
    slide: "defense",
    itemKey: "deny.instruction",
    action: "replace",
    replacementValue: "Versión B",
  },
];
const discrepancies = detectDiscrepancies(overridesA, overridesB);
check("detectDiscrepancies finds 1 discrepancy", discrepancies.length === 1);
check(
  "discrepancy has correct itemKey",
  discrepancies[0]?.itemKey === "deny.instruction",
);

const overridesSame: any[] = [
  {
    playerId: "p1",
    coachId: "c2",
    slide: "defense",
    itemKey: "deny.instruction",
    action: "replace",
    replacementValue: "Versión A",
  },
];
const noDiscrepancies = detectDiscrepancies(overridesA, overridesSame);
check("same value = no discrepancy", noDiscrepancies.length === 0);

const fewOverrides: any[] = [1, 2].map((i) => ({
  playerId: `p${i}`,
  coachId: "c1",
  slide: "defense",
  itemKey: "deny.instruction",
  action: "replace",
  replacementValue: "Mi instrucción",
  archetypeKey: "archetype_iso_scorer",
}));
const noPatterns = detectPatterns(fewOverrides, 3);
check("below threshold = no pattern", noPatterns.length === 0);

const manyOverrides: any[] = [1, 2, 3].map((i) => ({
  playerId: `p${i}`,
  coachId: "c1",
  slide: "defense",
  itemKey: "deny.instruction",
  action: "replace",
  replacementValue: "Mi instrucción",
  archetypeKey: "archetype_iso_scorer",
}));
const patterns = detectPatterns(manyOverrides, 3);
check("threshold met = 1 pattern detected", patterns.length === 1);
check(
  "pattern has correct fieldKey",
  patterns[0]?.fieldKey === "deny.instruction",
);
check("pattern confidence = 1.0", patterns[0]?.confidence === 1.0);

const record = buildOverrideRecord({
  playerId: "p1",
  coachId: "c1",
  slide: "defense",
  itemKey: "deny.instruction",
  action: "replace",
  replacementValue: "test",
  originalScore: 0.85,
  replacementScore: 0.72,
  archetypeKey: "archetype_iso_scorer",
  locale: "es",
});
check(
  "buildOverrideRecord has all fields",
  record.playerId === "p1" &&
    record.originalScore === 0.85 &&
    record.replacementScore === 0.72 &&
    record.archetypeKey === "archetype_iso_scorer",
);

console.log(`\n✓ ${passed} passed  ✗ ${failed} failed\n`);
if (errors.length > 0) errors.forEach((e) => console.log(e));
