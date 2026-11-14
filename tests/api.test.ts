import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../backend/app";
import { A } from "../src/utils/engine";
async function fixture(overrides: any = {}) {
  const env = {
    HAL_VIEWER_KEY: "test-viewer",
    GEMINI_API_KEY: "server-secret",
    HAL_AI_SEARCH: "1",
  };
  const calls: any[] = [];
  const feed = async (path: string) => ({
    status: 200,
    data:
      path === "/api/data"
        ? {
            quote: { price: 5000 },
            quote_as_of: "2026-10-17T04:00:00Z",
            stale: true,
            data_status: "stale",
          }
        : { spot: { last_price: 5000 }, futures: [], available_expiries: [] },
  });
  const generate = async (args: any) => {
    calls.push(args);
    return { text: "Measured response", candidates: [] };
  };
  const app = createApp({ feed, generate, env, ...overrides });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const port = (server.address() as any).port;
  const request = async (path: string, body?: any, headers: any = {}) => {
    const r = await fetch("http://127.0.0.1:" + port + path, {
      method: body ? "POST" : "GET",
      headers: {
        "X-HAL-Viewer-Key": "test-viewer",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  };
  return {
    request,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
test("all data and AI routes require the separate viewer key before any work", async () => {
  let fed = 0;
  const f = await fixture({
    feed: async () => {
      fed++;
      return { status: 200, data: {} };
    },
  });
  try {
    for (const path of [
      "/api/data",
      "/api/upstox/hal",
      "/api/upstox/research",
      "/api/config",
    ])
      assert.equal(
        (await f.request(path, undefined, { "X-HAL-Viewer-Key": "wrong" }))
          .status,
        403,
      );
    assert.equal(
      (
        await f.request(
          "/api/ai/copilot",
          { consent: true, book: A.emptyBook(), message: "risk" },
          { "X-HAL-Viewer-Key": "" },
        )
      ).status,
      403,
    );
    assert.equal(fed, 0);
    assert.equal(f.calls.length, 0);
  } finally {
    await f.close();
  }
});
test("no configured viewer key fails closed", async () => {
  const f = await fixture({ env: { GEMINI_API_KEY: "secret" } });
  try {
    assert.equal((await f.request("/api/config")).status, 503);
  } finally {
    await f.close();
  }
});
test("feed failure is unavailable rather than fabricated Upstox data", async () => {
  const f = await fixture({
    feed: async () => {
      throw Error("sensitive-provider-detail");
    },
  });
  try {
    const r = await f.request("/api/upstox/hal");
    assert.equal(r.status, 503);
    assert.equal(r.data.spot, undefined);
    assert.ok(!JSON.stringify(r.data).includes("sensitive"));
  } finally {
    await f.close();
  }
});
test("AI requires consent, validated book and same-origin requests", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.request("/api/ai/copilot", {
          book: A.emptyBook(),
          message: "risk",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request("/api/ai/copilot", {
          consent: true,
          book: {},
          message: "risk",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request(
          "/api/ai/copilot",
          { consent: true, book: A.emptyBook(), message: "risk" },
          { Origin: "https://attacker.test" },
        )
      ).status,
      403,
    );
    assert.equal(f.calls.length, 0);
  } finally {
    await f.close();
  }
});
test("AI rejects a downgraded HTTP origin even when the host matches", async () => {
  const f = await fixture({
    env: {
      HAL_VIEWER_KEY: "test-viewer",
      GEMINI_API_KEY: "server-secret",
      HAL_AI_SEARCH: "1",
      HAL_PUBLIC_ORIGIN: "https://hal.example.test",
    },
  });
  try {
    const body = {consent: true, book: A.emptyBook(), message: "Explain my HAL risk"};
    assert.equal((await f.request("/api/ai/copilot", body, { Origin: "http://hal.example.test" })).status, 403);
    assert.equal((await f.request("/api/ai/copilot", body, { Origin: "https://hal.example.test" })).status, 200);
    assert.equal(f.calls.length, 1);
  } finally {
    await f.close();
  }
});
test("AI uses server evidence, retains stale status, and excludes secrets and personal notes", async () => {
  const f = await fixture();
  try {
    const b = A.emptyBook();
    b.notes = [{ title: "private note", text: "do-not-send-note" }];
    const r = await f.request("/api/ai/copilot", {
      consent: true,
      book: b,
      message: "risk",
      marketData: { quote: { price: 999999 } },
      metrics: { netDelta: 1000 },
    });
    assert.equal(r.status, 200);
    const context = JSON.parse(f.calls[0].contents);
    assert.equal(context.evidence.market.quote.price, 5000);
    assert.equal(context.evidence.market.stale, true);
    assert.equal(context.evidence.book.risk.futureUnits, 0);
    assert.ok(!f.calls[0].contents.includes("server-secret"));
    assert.ok(!f.calls[0].contents.includes("do-not-send-note"));
    assert.equal(r.data.grounded, false);
  } finally {
    await f.close();
  }
});
test("missing key and model failure produce explicit errors without fake research", async () => {
  for (const overrides of [
    { env: { HAL_VIEWER_KEY: "test-viewer" } },
    {
      generate: async () => {
        throw Error("secret-detail");
      },
    },
  ]) {
    const f = await fixture(overrides);
    try {
      const r = await f.request("/api/ai/copilot", {
        consent: true,
        book: A.emptyBook(),
        message: "risk",
      });
      assert.ok(r.status >= 500);
      assert.equal(r.data.success, false);
      assert.equal(r.data.grounded, false);
      assert.ok(!JSON.stringify(r.data).includes("secret-detail"));
    } finally {
      await f.close();
    }
  }
});
test("grounding badge requires real, safe provider source links", async () => {
  for (const sources of [
    [],
    [{ web: { title: "Bad", uri: "javascript:alert(1)" } }],
    [{ web: { title: "NSE", uri: "https://www.nseindia.com/filing" } }],
  ]) {
    const f = await fixture({
      generate: async () => ({
        text: "Research",
        candidates: [{ groundingMetadata: { groundingChunks: sources } }],
      }),
    });
    try {
      const r = await f.request("/api/ai/research", {
        consent: true,
        message: "HAL results",
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.grounded, sources[0]?.web?.title === "NSE");
    } finally {
      await f.close();
    }
  }
});
test("structured perspectives cannot overwrite server provenance", async () => {
  const f = await fixture({
    generate: async () => ({
      text: JSON.stringify({
        consensus: "Review",
        consensusSummary: "Data missing",
        agents: [
          { name: "Risk", stance: "Uncertain", keyPoints: ["Check quotes"] },
        ],
        recommendations: ["Refresh"],
        source: "verified-internal-dossier",
        grounded: true,
      }),
    }),
  });
  try {
    const r = await f.request("/api/ai/deliberate", {
      consent: true,
      book: A.emptyBook(),
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.source, "gemini-3.8-flash");
    assert.equal(r.data.grounded, false);
  } finally {
    await f.close();
  }
});
test("global quota protects the configured Gemini account", async () => {
  const f = await fixture({
    env: {
      HAL_VIEWER_KEY: "test-viewer",
      GEMINI_API_KEY: "secret",
      HAL_AI_HOURLY_LIMIT: "1",
    },
  });
  try {
    const body = { consent: true, book: A.emptyBook(), message: "risk" };
    assert.equal((await f.request("/api/ai/copilot", body)).status, 200);
    assert.equal((await f.request("/api/ai/copilot", body)).status, 429);
    assert.equal(f.calls.length, 1);
  } finally {
    await f.close();
  }
});
test("search grounding must be enabled explicitly", async () => {
  const f = await fixture({
    env: { HAL_VIEWER_KEY: "test-viewer", GEMINI_API_KEY: "secret" },
  });
  try {
    assert.equal(
      (
        await f.request("/api/ai/research", {
          consent: true,
          message: "HAL news",
        })
      ).status,
      503,
    );
    assert.equal(f.calls.length, 0);
  } finally {
    await f.close();
  }
});
