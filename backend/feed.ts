import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
export type Feed = (path: string) => Promise<{ status: number; data: any }>;
export async function startFeed() {
  const key = randomBytes(32).toString("hex");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HAL_VIEWER_KEY: key,
    PYTHONUNBUFFERED: "1",
  };
  delete env.GEMINI_API_KEY;
  const child = spawn(process.env.PYTHON || "python3", ["feed_service.py"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  const port: number = await new Promise((resolve, reject) => {
    const lines = createInterface({ input: child.stdout });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Feed worker did not start"));
    }, 10000);
    const fail = () => {
      clearTimeout(timer);
      reject(new Error("Feed worker unavailable"));
    };
    child.once("error", fail);
    child.once("exit", fail);
    lines.on("line", (line) => {
      try {
        const p = JSON.parse(line).port;
        if (Number.isInteger(p) && p > 0) {
          clearTimeout(timer);
          resolve(p);
        }
      } catch {
        /* No provider messages forwarded to clients. */
      }
    });
  });
  child.stderr.on("data", () => {}); // Never include provider internals in public responses.
  const read: Feed = async (path) => {
    if (exited) throw Error("Feed worker stopped");
    if (!/^\/api\/(data|agents|upstox\/(hal|research))(\?|$)/.test(path))
      throw Error("Unsupported feed");
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      headers: { "X-HAL-Viewer-Key": key },
      signal: AbortSignal.timeout(90000),
    });
    return { status: response.status, data: await response.json() };
  };
  return { read, healthy: () => !exited, stop: () => child.kill() };
}
