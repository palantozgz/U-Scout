#!/usr/bin/env tsx
/**
 * Diagnóstico: ejecuta processPossessions para un partido y muestra el error completo.
 * Uso: npx tsx scripts/debug_lineup.ts 1
 * 
 * Requiere .env en la raíz del repo con DATABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { processPossessions } from "../server/possessions";

const gameId = Number(process.argv[2] ?? 1);
const seasonId = 2092;

console.log(`[debug] processPossessions(${gameId}, ${seasonId})`);

processPossessions(gameId, seasonId)
  .then(() => {
    console.log("[debug] SUCCESS");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[debug] ERROR:", err);
    process.exit(1);
  });
