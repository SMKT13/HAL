import React, { useState } from "react";
import { viewerKey, setViewerKey } from "../utils/api";
import { importBook, replaceBook, download, RECOVERY_KEY } from "../utils/book";
import { Notice, Field } from "./UI";
export function SettingsModal({
  book,
  updateBook,
  onImport,
  onConnect,
  onClose,
}: any) {
  const [key, setKey] = useState(viewerKey()),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<any>(null);
  const preview = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 2000000) throw Error("Backup exceeds 2 MB.");
      setPending(importBook(JSON.parse(await file.text())));
      setMessage(
        "Backup validated. Review the counts before replacing the local book.",
      );
    } catch (e: any) {
      setPending(null);
      setMessage("Import rejected: " + e.message);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Desk settings"
        className="modal panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2>Desk settings & backup</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <h3>Connection</h3>
        <p className="muted small">
          Use the server’s HAL viewer key. Upstox and Gemini keys stay on the
          server. The viewer key is kept only for this browser session and
          excluded from backups.
        </p>
        <Field label="Viewer key">
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </Field>
        <button
          className="primary"
          onClick={() => {
            setViewerKey(key);
            onConnect();
          }}
        >
          Connect & refresh
        </button>
        <h3>Appearance & refresh</h3>
        <div className="form-grid">
          <Field label="Theme">
            <select
              aria-label="Theme"
              value={book.preferences.theme}
              onChange={(e) =>
                updateBook({
                  ...book,
                  preferences: { ...book.preferences, theme: e.target.value },
                })
              }
            >
              <option value="dark">Midnight</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </Field>
          <label className="consent">
            <input
              type="checkbox"
              checked={book.preferences.auto}
              onChange={(e) =>
                updateBook({
                  ...book,
                  preferences: { ...book.preferences, auto: e.target.checked },
                })
              }
            />
            Refresh every minute while visible
          </label>
        </div>
        <h3>Local book & backups</h3>
        <p className="muted small">
          Positions, journal, notes, bookmarks, hedge settings and preferences
          stay in this browser. They are shared with Gemini only when you
          explicitly run an AI request. Browser storage can be cleared; export a
          backup regularly.
        </p>
        <div className="actions">
          <button
            onClick={() =>
              download("hal-desk-backup.json", {
                app: "HAL Desk",
                schema: 2,
                exportedAt: new Date().toISOString(),
                book,
              })
            }
          >
            Export full backup
          </button>
          <label className="button">
            Import backup
            <input
              aria-label="Import backup"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                preview(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() => {
              try {
                const raw = localStorage.getItem(RECOVERY_KEY);
                if (!raw) throw Error("No recovery copy available.");
                setPending(importBook(JSON.parse(raw)));
                setMessage("Recovery copy loaded for review.");
              } catch (e: any) {
                setMessage(e.message);
              }
            }}
          >
            Review recovery copy
          </button>
        </div>
        <Notice>{message}</Notice>
        {pending && (
          <div className="import-review">
            <h3>Review replacement</h3>
            <p>
              {pending.legs.length} open legs · {pending.journal.length} journal
              entries · {pending.notes.length} notes ·{" "}
              {pending.bookmarks.length} bookmarks
              {pending.legacy ? " · Legacy reconciliation retained" : ""}
            </p>
            <p className="muted small">
              The current saved book will be retained as a recovery copy.
            </p>
            <button
              className="primary"
              onClick={() => {
                try {
                  const clean = replaceBook(localStorage, book, pending);
                  onImport(clean);
                  setPending(null);
                  setMessage("Imported and saved.");
                } catch (e: any) {
                  setMessage(e.message);
                }
              }}
            >
              Replace with reviewed backup
            </button>
            <button onClick={() => setPending(null)}>Cancel</button>
          </div>
        )}
      </section>
    </div>
  );
}
