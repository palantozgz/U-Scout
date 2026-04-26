#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "===== AUDIT U SCOUT — $(date) ====="
echo ""
echo "--- RUTAS API ---"
grep -n "app\.\(get\|post\|patch\|delete\)" server/routes.ts | grep "/api/" | head -60
echo ""
echo "--- MOTOR exports ---"
grep -n "^export" client/src/lib/motor-v4.ts | head -20
echo ""
echo "--- REPORTVIEWV4 imports+hooks ---"
grep -n "^import\|useState\|useQuery\|useMemo\|useEffect" client/src/pages/scout/ReportViewV4.tsx | head -30
echo ""
echo "--- console.log en producción ---"
grep -rn "console\.log" client/src/ --include="*.ts" --include="*.tsx" | head -20
echo ""
echo "--- npm run check ---"
npm run check 2>&1 | tail -5
echo "===== FIN ====="
