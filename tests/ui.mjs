import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
const port = 3102,
  base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "production",
    HAL_VIEWER_KEY: "qa-viewer",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let browser;
const now = Date.now(),
  stamp = new Date(now).toISOString(),
  day = (n) => new Date(now + n * 86400000).toISOString().slice(0, 10),
  e1 = day(12),
  e2 = day(42);
const quote = (price) => ({
  last_price: price,
  prev_close: price - 50,
  bid: price - 1,
  ask: price + 1,
  bid_quantity: 10000,
  ask_quantity: 10000,
  quote_as_of: stamp,
  last_trade_at: stamp,
  volume: 10000,
  open_interest: 90000,
});
const option = (strike, price) => ({
  lot_size: 150,
  ltp: price,
  bid: price - 1,
  ask: price + 1,
  oi: 90000,
  volume: 10000,
  iv: 30,
  delta: -0.4,
  theta: -2,
  quote: quote(price),
});
const chain = (expiry) => ({
  option_expiry: expiry,
  option_rows: [
    {
      strike: 4900,
      put: option(4900, expiry === e1 ? 100 : 150),
      call: option(4900, 200),
    },
    { strike: 5000, put: option(5000, 150), call: option(5000, 100) },
  ],
  fetched_at_iso: stamp,
  quotes_fetched_at: stamp,
});
const snapshot = {
  spot: quote(5000),
  futures: [
    { expiry: e1, lot_size: 150, quote: quote(5020) },
    { expiry: e2, lot_size: 150, quote: quote(5050) },
  ],
  available_expiries: [e1, e2],
  ...chain(e1),
};
const candleRows = Array.from({ length: 220 }, (_, i) => {
  const d = new Date(now - (220 - i) * 86400000).toISOString().slice(0, 10);
  return { d, o: 4800 + i, h: 4820 + i, l: 4780 + i, c: 4810 + i, v: 50000 };
});
const market = {
  quote: { price: 5000, prev_close: 4950 },
  daily: candleRows,
  ind: {
    sma20: 5000,
    sma50: 4970,
    sma200: 4900,
    rsi14: 55,
    macd_hist: 2,
    atr14: 45,
  },
  levels: {},
  indicator_session: day(-1),
  last_session: day(-1),
  fetched_at_iso: stamp,
  quote_as_of: stamp,
  source: "Synthetic QA feed",
  data_status: "fresh_fetch",
};
const book = {
  version: 2,
  legs: [
    {
      type: "FUT",
      expiry: e1,
      lots: 2,
      lotSize: 150,
      entry: 5000,
      strike: null,
      manual: null,
      manualAt: null,
    },
    {
      type: "PE",
      expiry: e1,
      lots: 1,
      lotSize: 150,
      entry: 90,
      strike: 4900,
      manual: null,
      manualAt: null,
    },
  ],
  journal: [],
  notes: [],
  bookmarks: [],
  funding: { margin: null, free: null, at: null },
  preferences: { theme: "dark", auto: false, markMode: "ltp" },
  hedge: {
    budget: 100000,
    maxLoss: 200000,
    protectThrough: day(7),
    buyFees: 10,
    exitFees: 10,
    slippage: 0.5,
    maxSpread: 10,
    ivShift: 0,
    rate: 6,
    dividend: 0,
  },
};
const errors = [];
let aiCalls = 0,
  requested = [],
  delayedCopilot = null;
server.stdout.on("data", (d) => console.log("server:", d.toString().trim()));
server.stderr.on("data", (d) =>
  console.log("server error:", d.toString().trim()),
);
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(
    ({ book }) => {
      sessionStorage.setItem("hal_viewer_session", "qa-viewer");
      if (!localStorage.getItem("hal_desk_v2"))
        localStorage.setItem("hal_desk_v2", JSON.stringify(book));
    },
    { book },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGE ERROR:", e.message);
  });
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    requested.push(u.pathname + u.search);
    let data,
      status = 200;
    if (u.pathname === "/api/data") data = market;
    else if (u.pathname === "/api/upstox/hal") data = snapshot;
    else if (u.pathname === "/api/config")
      data = { aiEnabled: true, model: "qa-gemini", searchEnabled: true };
    else if (u.pathname.startsWith("/api/ai/")) {
      aiCalls++;
      if (u.pathname.endsWith("/copilot") && delayedCopilot) {
        delayedCopilot.started();
        await delayedCopilot.gate;
        data = {
          source: "qa-gemini",
          grounded: false,
          generatedAt: stamp,
          reply: "Late response for an earlier Copilot request.",
          sources: [],
        };
      } else if (u.pathname.endsWith("/research"))
        data = {
          source: "qa-gemini",
          grounded: false,
          generatedAt: stamp,
          reply: "No search sources returned.",
          sources: [],
        };
      else {
        status = 502;
        data = {
          error: "Gemini unavailable in this test. No fallback research.",
        };
      }
    } else if (u.pathname === "/api/upstox/research") {
      const s = u.searchParams.get("section"),
        frame = u.searchParams.get("frame");
      let payload = {};
      if (s === "hedges" || s === "chain") payload = chain(frame);
      if (s === "candles")
        payload = {
          history: {
            candles: candleRows.map((r) => [
              r.d + "T09:15:00+05:30",
              r.o,
              r.h,
              r.l,
              r.c,
              r.v,
            ]),
          },
        };
      if (s === "news")
        payload = {
          articles: {
            HAL: [
              {
                heading: "Synthetic HAL test headline",
                article_link: "https://www.nseindia.com/qa",
                published_time: now,
                summary: "QA news only",
              },
            ],
          },
        };
      if (s === "filings")
        payload = {
          items: [
            {
              title: "Synthetic HAL filing",
              url: "https://www.nseindia.com/test-filing",
              published: stamp,
              official: true,
              source: "NSE disclosure",
            },
          ],
        };
      if (s === "fundamentals")
        payload = {
          income: {
            income_statement: [
              {
                category: "revenue",
                history: [{ period: "QA Q1", value: 100 }],
              },
              {
                category: "net_profit",
                history: [{ period: "QA Q1", value: 20 }],
              },
            ],
          },
        };
      data = {
        data: payload,
        errors: {},
        source: "Synthetic QA provider",
        fetched_at_iso: stamp,
      };
    } else {
      status = 404;
      data = { error: "Unknown fixture" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Clarity for your HAL book." })
    .waitFor();
  const nav = (name) =>
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name, exact: true })
      .click();
  await nav("Position Desk");
  await page.getByText("HAL FUT", { exact: true }).waitFor();
  const initial = await page.evaluate(() =>
    localStorage.getItem("hal_desk_v2"),
  );
  await page.getByLabel("Mark mode").selectOption("bid");
  assert.equal(
    JSON.parse(await page.evaluate(() => localStorage.getItem("hal_desk_v2")))
      .preferences.markMode,
    "bid",
  );
  await page.getByRole("button", { name: "Put hedge", exact: true }).click();
  await page.getByRole("button", { name: "Refresh & compare puts" }).click();
  await page.getByText("Lower cost", { exact: false }).first().waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Apply|Adopt/ }).count(),
    0,
  );
  assert.deepEqual(
    JSON.parse(await page.evaluate(() => localStorage.getItem("hal_desk_v2")))
      .legs,
    JSON.parse(initial).legs,
  );
  await nav("Markets");
  await page.getByRole("button", { name: "15 min", exact: true }).click();
  await page.waitForTimeout(100);
  assert.ok(requested.some((s) => s.includes("section=candles&frame=15m")));
  await page.getByRole("button", { name: "Futures", exact: true }).click();
  await page.getByRole("button", { name: "Price chart", exact: true }).click();
  assert.ok((await page.locator("canvas").count()) > 0);
  await page.getByRole("button", { name: "Option chain", exact: true }).click();
  await page.getByLabel("Option expiry").selectOption(e2);
  await page.waitForTimeout(100);
  assert.ok(requested.some((s) => s.includes("section=chain&frame=" + e2)));
  await nav("HAL Research");
  await page.getByText("QA Q1").first().waitFor();
  await nav("Newsroom");
  await page
    .getByRole("heading", { name: "Synthetic HAL test headline" })
    .waitFor();
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  assert.equal(
    JSON.parse(await page.evaluate(() => localStorage.getItem("hal_desk_v2")))
      .bookmarks.length,
    1,
  );
  await nav("AI Copilot");
  await page
    .getByRole("button", { name: "Run six-perspective review" })
    .waitFor();
  assert.equal(aiCalls, 0);
  assert.ok(
    await page
      .getByRole("button", { name: "Run six-perspective review" })
      .isDisabled(),
  );
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Run six-perspective review" })
    .click();
  await page
    .getByText("Gemini unavailable in this test. No fallback research.")
    .waitFor();
  assert.equal(aiCalls, 1);
  await page
    .getByRole("button", { name: "Search research", exact: true })
    .click();
  await page.getByLabel("Research query").fill("HAL official results");
  await page
    .getByRole("button", { name: "Research with search", exact: true })
    .click();
  await page.getByText("No live search grounding", { exact: true }).waitFor();
  // A late Copilot response must never render as a six-perspective result.
  let releaseCopilot, markCopilotStarted;
  const copilotStarted = new Promise((resolve) => {
    markCopilotStarted = resolve;
  });
  delayedCopilot = {
    started: markCopilotStarted,
    gate: new Promise((resolve) => {
      releaseCopilot = resolve;
    }),
  };
  await page
    .getByRole("button", { name: "Position Copilot", exact: true })
    .click();
  await page.getByLabel("Your question").fill("Review the recorded hedge");
  await page.getByRole("button", { name: "Ask Copilot", exact: true }).click();
  await copilotStarted;
  await page
    .getByRole("button", { name: "Six perspectives", exact: true })
    .click();
  const lateResponse = page.waitForResponse("**/api/ai/copilot");
  releaseCopilot();
  await (await lateResponse).finished();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.deepEqual(
    errors,
    [],
    "Switching AI modes while a request is pending must not crash the desk",
  );
  assert.equal(
    await page
      .getByText("Late response for an earlier Copilot request.")
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Run six-perspective review", exact: true })
    .waitFor();
  delayedCopilot = null;
  await page
    .getByRole("button", { name: "Desk settings", exact: true })
    .click();
  const imported = structuredClone(book);
  imported.legs = Array.from({ length: 12 }, () => ({ ...book.legs[0] }));
  imported.notes = [
    {
      id: "note",
      date: day(0),
      title: "Imported thesis",
      text: "Retained after reload",
      category: "Other",
    },
  ];
  imported.journal = [
    {
      id: "fee",
      date: day(0),
      kind: "fee",
      amount: 25,
      note: "Imported charge",
    },
  ];
  await page.getByLabel("Import backup", { exact: true }).setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ book: imported })),
  });
  await page
    .getByRole("button", { name: "Replace with reviewed backup" })
    .click();
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await page
    .getByRole("heading", { name: "Clarity for your HAL book." })
    .waitFor();
  let saved = JSON.parse(
    await page.evaluate(() => localStorage.getItem("hal_desk_v2")),
  );
  assert.equal(saved.legs.length, 12);
  assert.equal(saved.journal[0].amount, 25);
  assert.equal(saved.notes[0].text, "Retained after reload");
  assert.equal(saved.preferences.theme, "light");
  assert.ok(
    await page.evaluate(() => !!localStorage.getItem("hal_before_import_v2")),
  );
  await page
    .getByRole("button", { name: "Desk settings", exact: true })
    .click();
  await page.getByLabel("Import backup", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"position":{"fq":-1}}'),
  });
  await page.getByText(/Import rejected:/).waitFor();
  assert.equal(
    JSON.parse(await page.evaluate(() => localStorage.getItem("hal_desk_v2")))
      .legs.length,
    12,
  );
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS React desktop/mobile: six screens, exact marks, hedge immutability, chart remount, timeframe/expiry feeds, bookmarks, consent, AI errors/provenance, AI mode-switch race, 12-leg import, reload persistence, recovery, invalid-import rejection, themes.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
