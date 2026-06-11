import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "10mb" }));

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
    throw err;
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
        processAllPendingPossessions(2092).catch(err =>
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
