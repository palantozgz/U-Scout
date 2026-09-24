import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      // Los archivos generados por Vite llevan hash en el nombre (index-XXXX.js),
      // asi que son seguros de cachear agresivamente: si cambia el contenido, cambia el nombre.
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          // index.html nunca debe quedarse en cache -- es el punto de entrada que
          // referencia los assets con hash. Si esto se cachea, los usuarios (o la
          // WKWebView de la app nativa) pueden quedarse pegados en una version vieja
          // indefinidamente, incluso tras relanzar la app.
          res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        } else {
          res.set("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
