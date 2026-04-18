import { generateMotorV4 } from "../client/src/lib/motor-v4";
import { renderReport } from "../client/src/lib/reportTextRenderer";
import testProfiles from "./test-profiles.json";

const locales = ["en", "es", "zh"] as const;
const genders = ["f", "m"] as const;

let passed = 0;
let failed = 0;
const errors: string[] = [];

for (const profile of testProfiles as any[]) {
  for (const locale of locales) {
    for (const gender of genders) {
      try {
        const motor = generateMotorV4(profile.inputs, profile.clubContext);
        const rendered = renderReport(motor, { locale, gender });

        const checks: [string, boolean][] = [
          ["identity.archetypeLabel not empty", rendered.identity.archetypeLabel.length > 0],
          ["identity.tagline not empty", rendered.identity.tagline.length > 0],
          ["situations not empty", rendered.situations.length > 0],
          ["situations[0].description not empty", rendered.situations[0].description.length > 0],
          ["deny.instruction not empty", rendered.defense.deny.instruction.length > 0],
          ["force.instruction not empty", rendered.defense.force.instruction.length > 0],
          ["allow.instruction not empty", rendered.defense.allow.instruction.length > 0],
          ["deny not key", !rendered.defense.deny.instruction.includes("deny_")],
          ["force not key", !rendered.defense.force.instruction.includes("force_")],
        ];

        const failedChecks = checks.filter(([, v]) => !v);
        if (failedChecks.length === 0) {
          passed++;
        } else {
          failed++;
          errors.push(
            `FAIL [${profile.name}/${locale}/${gender}]: ${failedChecks.map(([k]) => k).join(", ")}`,
          );
        }
      } catch (e) {
        failed++;
        errors.push(`ERROR [${profile.name}/${locale}/${gender}]: ${e}`);
      }
    }
  }
}

const total = passed + failed;
console.log(`\n✓ ${passed}/${total} passed  ✗ ${failed} failed\n`);
if (errors.length > 0) errors.forEach((e) => console.log(e));

const luka = (testProfiles as any[])[0];
const motor = generateMotorV4(luka.inputs, luka.clubContext);
const r = renderReport(motor, { locale: "es", gender: "m" });
console.log("\n--- LUKA / es / m ---");
console.log("arquetipo:", r.identity.archetypeLabel);
console.log("tagline:", r.identity.tagline);
console.log("situaciones:");
r.situations.forEach((s) =>
  console.log(
    ` ${s.tier.padEnd(12)} ${s.label.padEnd(20)} ${s.description.slice(0, 60)}...`,
  ),
);
console.log("DENY:", r.defense.deny.instruction);
console.log("FORCE:", r.defense.force.instruction);
console.log("ALLOW:", r.defense.allow.instruction);
console.log("ALERTAS:", r.alerts.map((a) => a.text).join(" | "));
