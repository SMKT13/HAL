import { A, C } from "./engine";
export const BOOK_KEY = "hal_desk_v2";
export const RECOVERY_KEY = "hal_before_import_v2";
export function importBook(doc: any) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc))
    throw Error("Choose a HAL Desk backup.");
  if (doc.book || doc.legs) {
    let b = doc.book || doc;
    if (b.version === 1) b = { ...A.emptyBook(), legs: b.legs };
    return A.validateBook(b);
  }
  const p = doc.position;
  if (!p) throw Error("No position book found in this backup.");
  const b = A.emptyBook();
  if (!Number.isInteger(p.lot) || p.lot <= 0)
    throw Error("Legacy book needs a verified lot size.");
  for (const key of ["f", "p1", "p2"]) {
    const qty = p[key + "q"];
    if (!Number.isInteger(qty) || qty < 0 || qty % p.lot !== 0)
      throw Error(
        "Legacy quantities must be whole contract lots. Original data has been preserved.",
      );
    if (qty)
      b.legs.push({
        type: key === "f" ? "FUT" : "PE",
        expiry: p[key + "expiry"] || p.expiry,
        lots: qty / p.lot,
        lotSize: p.lot,
        entry: p[key + "a"],
        strike: key === "f" ? null : p[key + "strike"],
        manual: p[key + "mark"] ?? null,
        manualAt: p[key + "markAt"] ?? null,
      });
  }
  if (!C.finite(p.realized) || !C.finite(p.costs) || p.costs < 0)
    throw Error("Invalid legacy realized P&L or costs.");
  const journals = doc.journal ?? [];
  if (!Array.isArray(journals)) throw Error("Invalid journal.");
  b.journal = journals.filter((j: any) => j.kind === "close" && j.leg);
  b.legacy = {
    realized: p.realized,
    costs: p.costs,
    journal: journals.filter((j: any) => !(j.kind === "close" && j.leg)),
  };
  // Legacy amount-only entries were a notebook, not an automatic ledger. Preserve
  // them separately so importing cannot count an existing realized total twice.
  b.notes = doc.notes ?? [];
  b.bookmarks = doc.bookmarks ?? [];
  if (doc.funding)
    b.funding = {
      ...doc.funding,
      at: doc.funding.at || doc.funding.savedAt || null,
    };
  if (doc.preferences) b.preferences = doc.preferences;
  if (doc.hedge) b.hedge = doc.hedge;
  return A.validateBook(b);
}
export function loadBook(storage: Storage) {
  try {
    const saved = storage.getItem(BOOK_KEY);
    if (saved) return { book: importBook(JSON.parse(saved)), notice: "" };
    const native = storage.getItem("hal_positions_v1");
    if (native)
      return {
        book: importBook(JSON.parse(native)),
        notice:
          "Previous Android book loaded. Save or export to retain this format.",
      };
    const web = storage.getItem("halpos3") || storage.getItem("halpos2");
    if (web) {
      const read = (key: string, fallback: any) =>
        JSON.parse(storage.getItem(key) || JSON.stringify(fallback));
      return {
        book: importBook({
          position: JSON.parse(web),
          funding: read("halfunding", null),
          journal: read("haljournal", []),
          notes: read("halnotes", []),
        }),
        notice:
          "Your earlier book was recovered. Legacy realized totals and notebook entries are kept separately; review them before making ledger adjustments.",
      };
    }
    return { book: A.emptyBook(), notice: "" };
  } catch (e: any) {
    return {
      book: A.emptyBook(),
      notice:
        "Saved data needs review: " +
        e.message +
        " Existing storage has been preserved.",
      blocked: true,
    };
  }
}
export function saveBook(storage: Storage, book: any) {
  const clean = A.validateBook(book);
  storage.setItem(BOOK_KEY, JSON.stringify(clean));
  return clean;
}
export function replaceBook(storage: Storage, current: any, input: any) {
  const clean = importBook(input); // Validate everything before touching storage/state.
  storage.setItem(
    RECOVERY_KEY,
    storage.getItem(BOOK_KEY) || JSON.stringify(current),
  );
  return saveBook(storage, clean);
}
export function download(name: string, value: any, type = "application/json") {
  const blob = new Blob(
    [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
    { type },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(value: any) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
