# WCBA Collector — U Core

Collector de estadísticas WCBA para Raspberry Pi 5.

## Setup rápido (cuando llegue el SSD)

```bash
# 1. Flash Raspberry Pi OS Lite 64-bit en el SSD
# 2. SSH + instalar dependencias
ssh pablo@ucore-pi.local
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# 3. Clonar repo y configurar
cd ~
git clone https://github.com/TU_REPO/U-scout.git ucore
cd ucore/collector
npm install
npm run build
cp .env.example .env
nano .env   # rellenar UCORE_API_URL, STATS_INGEST_KEY, TELEGRAM_BOT_TOKEN

# 4. Arrancar con PM2
pm2 start dist/index.js --name ucore-collector
pm2 save
pm2 logs ucore-collector
```

## Comandos Telegram

| Comando | Acción |
|---------|--------|
| `/status` | Estado del collector |
| `/sync` | Forzar sync manual |
| `/reboot` | Reiniciar proceso |
| `/season` | Ver seasonId activo |
| `/setseason XXXX` | Cambiar temporada en runtime |
| `/logs [N]` | Últimas N líneas de log |
| `/errors` | Últimas 10 líneas de error.log |
| `/games` | Resumen partidos sincronizados |
| `/test` | Verificar API WCBA responde |

## Verificar calibración shot zones

```bash
cd collector
npm run calibrate
```

## Estructura

```
collector/
  src/
    index.ts        — entry + cron scheduler
    config.ts       — env vars
    client.ts       — axios WCBA + UCore
    ingest.ts       — POST /api/stats/ingest con retry
    logger.ts       — winston
    bot.ts          — Telegram bot
    sync/
      phases.ts     — matchmenus
      schedule.ts   — partidos + live detection
      standings.ts  — clasificación
      boxscores.ts  — resultados por partido
      playerstats.ts — stats individuales paginado
      pbp.ts        — play-by-play + hotspotdata
      shotZones.ts  — clasificación zonas de tiro (calibrado 2 may 2026)
```
