import express, { type Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { registerRoutes } from "./routes";
import { CURRENT_SEASON_ID } from "../shared/season";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Railway sits behind its own edge proxy -- sin esto, express-rate-limit
// no puede leer X-Forwarded-For correctamente (o lanza ERR_ERL_UNEXPECTED_X_FORWARDED_FOR).
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Rate limit: guarda basico contra abuso/scraping en /api. Generoso a
// proposito (club pequeno, TanStack Query con staleTime largo, collector
// del Pi llamando a los endpoints de ingest) -- no es estricto, es un piso
// que antes no existia en absoluto.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "2mb" }));

// Ensure browsers requesting the default /favicon.ico get an icon asset (dev + prod).
app.get("/favicon.ico", (_req, res) => {
  res.redirect(302, "/favicon.svg?v=5");
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

(async () => {
  const server = await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    console.error(`[error-handler] ${status} ${message}`, err.stack ?? err);
  });

  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(server, app);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT ?? "5000", 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);

    // Auto-process pending possessions on startup (fire-and-forget)
    setTimeout(() => {
      import('./possessions').then(({ processAllPendingPossessions }) => {
        processAllPendingPossessions(CURRENT_SEASON_ID).catch(err =>
          console.error('[startup] possessions auto-process failed:', err.message)
        );
      });
    }, 5000); // 5s delay to let DB connections stabilize

    // Self-ping keepalive — prevents Railway from sleeping the instance.
    // Railway Hobby tier sleeps after ~30min of inactivity. A self-ping every
    // 4min keeps the instance warm without requiring an external service.
    // Only runs in production to avoid noise in development.
    if (process.env.NODE_ENV === 'production') {
      const selfUrl = process.env.RAILWAY_STATIC_URL
        ?? process.env.RAILWAY_PUBLIC_DOMAIN
        ?? null;
      if (selfUrl) {
        const pingUrl = `https://${selfUrl}/api/ping`;
        setInterval(() => {
          fetch(pingUrl).catch(() => {}); // fire-and-forget, errors silenced
        }, 4 * 60 * 1000); // every 4 minutes
        log(`[keepalive] self-ping active → ${pingUrl}`);
      }
    }
  });
})();
