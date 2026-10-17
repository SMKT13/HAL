import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { startFeed } from "./backend/feed";
import { createApp } from "./backend/app";

const worker = await startFeed();
const app = createApp({ feed: worker.read, healthy: worker.healthy });
const root = path.dirname(fileURLToPath(import.meta.url));
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist"), { index: false }));
  app.get("*", (_req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const listener = app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log("HAL Desk ready"),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    worker.stop();
    listener.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
process.once("exit", () => worker.stop());
