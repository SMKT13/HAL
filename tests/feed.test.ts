import test from "node:test";
import assert from "node:assert/strict";
import { startFeed } from "../backend/feed";

test("the real Python worker retains the read-only Upstox routes", async () => {
  const worker = await startFeed({
    env: { ...process.env, UPSTOX_ACCESS_TOKEN: "", GEMINI_API_KEY: "" },
  });
  try {
    assert.equal(worker.healthy(), true);
    for (const path of [
      "/api/upstox/hal",
      "/api/upstox/research?section=candles&frame=D",
    ]) {
      const response = await worker.read(path);
      assert.equal(response.status, 503, path);
      assert.equal(response.data.error, "token_missing", path);
    }
    await assert.rejects(worker.read("/api/orders"), /Unsupported feed/);
  } finally {
    worker.stop();
  }
});
