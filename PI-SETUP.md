# Setup Raspberry Pi 5 — SSD desde Mac
# Generado: 2 mayo 2026
# Tiempo estimado: 20-30 minutos

## PASO 1 — Flash del SSD (desde el Mac, SSD conectado por USB)

1. Descarga Raspberry Pi Imager:
   https://www.raspberrypi.com/software/

2. Abre Raspberry Pi Imager:
   - Device: Raspberry Pi 5
   - OS: Raspberry Pi OS Lite (64-bit)  ← sin escritorio, más ligero
   - Storage: tu SSD (aparece como disco externo)

3. Antes de escribir, pulsa el icono de engranaje (⚙️) o "Edit Settings":
   - Hostname: ucore-pi
   - Username: pablo
   - Password: (elige una contraseña segura)
   - Configure wireless LAN:
       SSID: (nombre de tu WiFi)
       Password: (contraseña WiFi)
       Country: CN
   - Enable SSH: Using password authentication ✅
   - Locale: Asia/Shanghai, teclado es

4. Pulsa "Write" y espera (~5-10 min)

---

## PASO 2 — Preparar el collector en el SSD desde el Mac

Una vez flasheado el SSD, lo monta en el Mac (aparece en Finder).
Verás dos particiones: bootfs y rootfs.

### Verificar SSH está activado
En bootfs debe existir un archivo llamado `ssh` (sin extensión, vacío).
Si no existe, créalo:
```bash
touch /Volumes/bootfs/ssh
```

### Copiar el collector al SSD
```bash
# El SSD estará montado como /Volumes/rootfs (o similar — verificar en Finder)
sudo cp -r "/Users/palant/Downloads/U scout/collector" /Volumes/rootfs/home/pablo/
```

### Copiar el schema SQL al SSD (por si acaso)
```bash
sudo cp "/Users/palant/Downloads/U scout/supabase-stats-schema.sql" /Volumes/rootfs/home/pablo/
```

---

## PASO 3 — Primer arranque (Pi conectada, SSD conectado a la Pi)

1. Conecta el SSD a la Pi (USB 3.0 — puerto azul)
2. Conecta alimentación a la Pi
3. Espera 2 minutos (primer arranque es más lento)

### Conectar por SSH desde el Mac (misma red WiFi):
```bash
ssh pablo@ucore-pi.local
# Si no resuelve el hostname, busca la IP en tu router y usa:
# ssh pablo@192.168.x.x
```

---

## PASO 4 — Instalar dependencias en la Pi

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # debe mostrar v20.x

# PM2
sudo npm install -g pm2
pm2 startup systemd -u pablo --hp /home/pablo
# Copia y ejecuta el comando que PM2 imprime

# Tailscale (para acceso remoto desde cualquier red)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Autenticar en tailscale.com/admin desde el móvil
```

---

## PASO 5 — Configurar y arrancar el collector

```bash
cd /home/pablo/collector

# Instalar dependencias y compilar
npm install
npm run build

# Configurar variables de entorno
cp .env.example .env
nano .env
```

### Rellenar en .env:
```
UCORE_API_URL=https://u-scout-production.up.railway.app
STATS_INGEST_KEY=<generar con: openssl rand -hex 32>
WCBA_BASE_URL=https://www.cba.net.cn
WCBA_COMPETITION_ID=56
WCBA_SEASON_ID=2092
TELEGRAM_BOT_TOKEN=<token del bot>
TELEGRAM_CHAT_ID=<tu chat id>
```

### Arrancar con PM2:
```bash
pm2 start dist/index.js --name ucore-collector
pm2 save
pm2 logs ucore-collector --lines 50
```

---

## PASO 6 — Verificar que todo funciona

En Telegram, el bot debe enviar: "🚀 U Core Collector iniciado"
Luego envía `/test` — debe responder con el número de equipos en standings.
Luego `/status` — debe mostrar el estado del collector.

Si algo falla: `/errors` muestra las últimas líneas del error log.

---

## PASO 7 — Ejecutar schema en Supabase

Abre Supabase → SQL Editor → pega el contenido de:
`/home/pablo/supabase-stats-schema.sql`
(o desde el Mac: `/Users/palant/Downloads/U scout/supabase-stats-schema.sql`)

Ejecuta y verifica que el resultado final muestra las 9 tablas con sus columnas.

---

## PASO 8 — Añadir STATS_INGEST_KEY en Railway

Railway dashboard → U Scout project → Variables:
```
STATS_INGEST_KEY=<el mismo valor que pusiste en .env de la Pi>
```

Redeploy automático en Railway.

---

## NOTAS IMPORTANTES

- El collector hace un sync completo al arrancar — puede tardar varios minutos
  la primera vez si hay muchos partidos en la temporada
- Los logs están en: /home/pablo/collector/logs/
- El bot de Telegram es el panel de control principal — no necesitas SSH para el día a día
- Si la Pi pierde WiFi y lo recupera, PM2 la reinicia automáticamente
- Para actualizar el collector:
  ```bash
  cd /home/pablo/collector
  git pull  # si tienes el repo clonado
  npm run build
  pm2 restart ucore-collector
  ```
