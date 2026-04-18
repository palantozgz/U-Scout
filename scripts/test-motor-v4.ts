import { generateMotorV4 } from "../client/src/lib/motor-v4";
import testProfiles from "./test-profiles.json";

let passed = 0;
let failed = 0;
const errors: string[] = [];

for (const profile of testProfiles as any[]) {
  try {
    const result = generateMotorV4(profile.inputs, profile.clubContext);

    const checks: [string, boolean][] = [
      ["situations not empty", result.situations.length > 0],
      ["deny winner exists", !!result.defense.deny.winner?.key],
      ["force winner exists", !!result.defense.force.winner?.key],
      ["allow winner exists", !!result.defense.allow.winner?.key],
      ["alerts <= 2", result.alerts.length <= 2],
      [
        "dangerLevel 1-5",
        result.identity.dangerLevel >= 1 && result.identity.dangerLevel <= 5,
      ],
      [
        "difficultyLevel 1-5",
        result.identity.difficultyLevel >= 1 &&
          result.identity.difficultyLevel <= 5,
      ],
      ["archetypeKey exists", result.identity.archetypeKey.length > 0],
      ["no spaces in keys", !result.defense.deny.winner.key.includes(" ")],
      ["no text in deny key", /^[a-z_]+$/.test(result.defense.deny.winner.key)],
    ];

    const failedChecks = checks.filter(([, v]) => !v);
    if (failedChecks.length === 0) {
      passed++;
    } else {
      failed++;
      errors.push(
        `FAIL [${profile.name}]: ${failedChecks.map(([k]) => k).join(", ")}`,
      );
    }
  } catch (e) {
    failed++;
    errors.push(`ERROR [${profile.name ?? "unknown"}]: ${e}`);
  }
}

console.log(`\n✓ ${passed} passed  ✗ ${failed} failed\n`);
if (errors.length > 0) errors.forEach((e) => console.log(e));

// Print sample output for first profile
import { generateMotorV4 } from '../client/src/lib/motor-v4';
import testProfiles from './test-profiles.json';
const sample = (testProfiles as any[])[0];
const r = generateMotorV4(sample.inputs, sample.clubContext);
console.log('\n--- SAMPLE:', sample.name, '---');
console.log('archetype:', r.identity.archetypeKey);
console.log('danger:', r.identity.dangerLevel, '| difficulty:', r.identity.difficultyLevel);
console.log('situations:', r.situations.slice(0,5).map(s => `${s.id}(${s.score.toFixed(2)}/${s.tier})`).join(', '));
console.log('deny winner:', r.defense.deny.winner.key, '|', r.defense.deny.alternatives.map(a=>a.key).join(', '));
console.log('force winner:', r.defense.force.winner.key);
console.log('allow winner:', r.defense.allow.winner.key);
console.log('alerts:', r.alerts.map(a=>`${a.key}(${a.mechanismType})`).join(', '));
