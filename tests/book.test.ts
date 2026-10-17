import test from "node:test";
import assert from "node:assert/strict";
import { A, C } from "../src/utils/engine";
import {
  loadBook,
  importBook,
  replaceBook,
  saveBook,
  csvCell,
  BOOK_KEY,
  RECOVERY_KEY,
} from "../src/utils/book";
class Memory {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}
const legacy = () => ({
  fq: 300,
  fa: 5000,
  fexpiry: "2026-12-31",
  p1q: 150,
  p1a: 50,
  p1strike: 4500,
  p1expiry: "2026-11-26",
  p2q: 150,
  p2a: 70,
  p2strike: 4600,
  p2expiry: "2026-12-31",
  lot: 150,
  realized: -7000,
  costs: 50,
});
const leg = () => ({
  type: "FUT",
  expiry: "2026-12-31",
  lots: 1,
  lotSize: 150,
  entry: 5000,
  manual: null,
});
test("first run is empty; corrupt storage is retained and never becomes template holdings", () => {
  const s = new Memory();
  assert.deepEqual(loadBook(s as any).book.legs, []);
  s.setItem("halpos3", "broken");
  const result = loadBook(s as any);
  assert.ok(result.blocked);
  assert.deepEqual(result.book.legs, []);
  assert.equal(s.getItem("halpos3"), "broken");
});
test("legacy book preserves quantities, manual marks, notes, journal and opening reconciliation", () => {
  const p = { ...legacy(), p1mark: 0, p1markAt: "2026-10-17T00:00:00Z" };
  const b = importBook({
    position: p,
    journal: [
      { date: "2026-10-16", kind: "fee", amount: 50, note: "already included" },
    ],
    notes: [{ title: "Thesis", text: "note", date: "2026-10-17" }],
  });
  assert.equal(b.legs.length, 3);
  assert.equal(b.legs[1].manual, 0);
  assert.equal(b.legacy.journal.length, 1);
  assert.equal(A.ledger(b, null).realized, -7000);
  assert.equal(A.ledger(b, null).charges, 50);
  assert.equal(b.notes[0].text, "note");
});
test("Android v2 backups keep every leg and settings through persistence", () => {
  const s = new Memory(),
    b = A.emptyBook();
  b.legs = Array.from({ length: 12 }, leg);
  b.notes = [{ title: "HAL", date: "2026-10-16", text: "saved" }];
  b.preferences.theme = "light";
  b.hedge.budget = 10000;
  replaceBook(s as any, A.emptyBook(), { book: b });
  const loaded = loadBook(s as any).book;
  assert.equal(loaded.legs.length, 12);
  assert.equal(loaded.hedge.budget, 10000);
  assert.equal(loaded.preferences.theme, "light");
  assert.equal(loaded.notes[0].text, "saved");
});
test("invalid import changes neither book nor recovery copy", () => {
  const s = new Memory(),
    b = A.emptyBook();
  b.legs = [leg()];
  saveBook(s as any, b);
  s.setItem(RECOVERY_KEY, "existing-recovery");
  const before = s.getItem(BOOK_KEY);
  assert.throws(
    () => replaceBook(s as any, b, { position: { ...legacy(), fq: 151 } }),
    /whole/,
  );
  assert.equal(s.getItem(BOOK_KEY), before);
  assert.equal(s.getItem(RECOVERY_KEY), "existing-recovery");
});
test("full backup round-trip retains journal and bookmarks and strips credentials", () => {
  const b = A.emptyBook();
  b.journal = [
    { id: "fee", date: "2026-10-17", kind: "fee", amount: 30, note: "fees" },
  ];
  b.bookmarks = [
    { title: "Filing", url: "https://www.nseindia.com/filing", source: "NSE" },
  ];
  const clean = importBook({ book: { ...b, token: "secret" } });
  assert.equal(clean.journal[0].amount, 30);
  assert.equal(clean.bookmarks.length, 1);
  assert.equal(clean.token, undefined);
});
test("CSV handles commas, quotes, newlines and spreadsheet formulas", () => {
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
});
test("bid marking uses provider bid and never changes entry or quantities", () => {
  const l = leg(),
    s = {
      futures: [
        {
          expiry: l.expiry,
          lot_size: 150,
          quote: {
            last_price: 5100,
            bid: 5090,
            quote_as_of: "2026-10-17T04:00:00Z",
          },
        },
      ],
    };
  assert.equal(C.mtm([l], s).total, 15000);
  assert.equal(C.mtm([l], { ...s, markMode: "bid" }).total, 13500);
  assert.equal(l.entry, 5000);
});
test("legacy realized totals survive subsequent actual close without double-counting settlements", () => {
  const b = importBook({ position: legacy() });
  const closed = A.closeLeg(b, 0, 1, 5100, 10, "2026-10-17");
  closed.journal.push({ kind: "settlement", date: "2026-10-17", amount: 8000 });
  const ledger = A.ledger(closed, null);
  assert.equal(ledger.realized, 8000);
  assert.equal(ledger.charges, 60);
  assert.equal(ledger.settlements, 8000);
});

test("full option quotes retain their own provider price and timestamp", () => {
  const l = {
    type: "PE",
    expiry: "2026-12-31",
    lots: 1,
    lotSize: 150,
    entry: 50,
    strike: 4900,
    manual: null,
  };
  const s = {
    option_expiry: l.expiry,
    fetched_at_iso: "2026-10-17T04:03:00Z",
    option_rows: [
      {
        strike: 4900,
        put: {
          lot_size: 150,
          ltp: 90,
          bid: 89,
          quote: {
            last_price: 100,
            bid: 99,
            quote_as_of: "2026-10-17T04:01:00Z",
          },
        },
      },
    ],
  };
  const result = C.mark(l, s);
  assert.equal(result.price, 100);
  assert.equal(result.stamp, "2026-10-17T04:01:00Z");
  assert.equal(C.mark(l, { ...s, markMode: "bid" }).price, 99);
});
