#!/usr/bin/env npx tsx
/**
 * U Scout Motor — Batch Test Script
 * Usage: npx tsx scripts/test-motor.ts
 *
 * Reads scripts/test-profiles.json, runs each profile through the motor,
 * writes scripts/test-results.json — compact output for review.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { motor } from '../client/src/lib/motor-v2.1';

const PROFILES_PATH = 'scripts/test-profiles.json';
const RESULTS_PATH  = 'scripts/test-results.json';

interface TestProfile {
  id: string;
  name: string;
  note?: string;
  inputs: Record<string, unknown>;
}

interface TestResult {
  id: string;
  name: string;
  deny: string[];
  force: string[];
  allow: string[];
  aware: string[];
  runners: string[];
  threats: string;
}

if (!existsSync(PROFILES_PATH)) {
  console.error(`\nNo se encontró ${PROFILES_PATH}`);
  console.error('Crea el archivo con perfiles primero.\n');
  process.exit(1);
}

const profiles: TestProfile[] = JSON.parse(readFileSync(PROFILES_PATH, 'utf8'));
console.log(`\nProcesando ${profiles.length} perfiles...\n`);

const results: TestResult[] = [];

for (const profile of profiles) {
  try {
    const report = motor.generateReport(profile.inputs as any);
    const deny    = (report.selected.deny  ?? []).map((o: any) => o.key);
    const force   = (report.selected.force ?? []).map((o: any) => o.key);
    const allow   = (report.selected.allow ?? []).map((o: any) => o.key);
    const aware   = (report.selected.aware ?? []).map((o: any) => o.key);
    const runners = (report.runnersUp ?? []).slice(0, 5).map((o: any) => o.key);
    const threats = (report.threatScores ?? [])
      .map((t: any) => `${t.situation}=${t.score.toFixed(2)}`)
      .join(',');
    results.push({ id: profile.id, name: profile.name, deny, force, allow, aware, runners, threats });
  } catch (e: any) {
    results.push({
      id: profile.id, name: profile.name,
      deny: [], force: [], allow: [], aware: [], runners: [],
      threats: `ERROR: ${e.message}`,
    });
  }
}

writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

for (const r of results) {
  const isError = r.threats.startsWith('ERROR');
  console.log(`${isError ? '💥' : '·'} [${r.id}] ${r.name}`);
  if (!isError) {
    if (r.deny.length)    console.log(`    DENY:    ${r.deny.join(', ')}`);
    if (r.force.length)   console.log(`    FORCE:   ${r.force.join(', ')}`);
    if (r.allow.length)   console.log(`    ALLOW:   ${r.allow.join(', ')}`);
    if (r.aware.length)   console.log(`    AWARE:   ${r.aware.join(', ')}`);
    if (r.runners.length) console.log(`    RUNNERS: ${r.runners.join(', ')}`);
    console.log(`    THREATS: ${r.threats}`);
  } else {
    console.log(`    ${r.threats}`);
  }
  console.log('');
}

console.log(`Resultados → ${RESULTS_PATH}`);
console.log('Pega el contenido de ese archivo en el chat para revisión.\n');
