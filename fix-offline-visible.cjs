const fs = require("fs");

const path = "client/src/lib/queryClient.ts";
let content = fs.readFileSync(path, "utf8");

// Añadir actualización de cache cuando offline POST
content = content.replace(
  'enqueueOfflineRequest({ method, url, body });',
  `enqueueOfflineRequest({ method, url, body });

// 👉 añadir a cache local para que aparezca en UI
if (url.includes("/api/players") && body) {
  try {
    const qc = window.__queryClient;
    if (qc) {
      const tempPlayer = {
        ...body,
        id: "offline-" + Date.now(),
      };

      qc.setQueryData(["/api/players"], (old = []) => [...old, tempPlayer]);

      if (body.teamId) {
        qc.setQueryData(["/api/players", body.teamId], (old = []) => [...old, tempPlayer]);
      }
    }
  } catch (e) {
    console.error("Offline cache update failed:", e);
  }
}`
);

fs.writeFileSync(path, content);
console.log("✅ OFFLINE VISIBILITY FIX aplicado");
