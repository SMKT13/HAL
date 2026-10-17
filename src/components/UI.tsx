import React from "react";
export function Panel({ title, children, action, className = "" }: any) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Metric({ label, value, note }: any) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function Notice({ children }: any) {
  return children ? (
    <p role="status" className="notice">
      {children}
    </p>
  ) : null;
}
export function Tabs({ value, items, onChange }: any) {
  return (
    <div className="subtabs">
      {items.map(([id, label]: any) => (
        <button
          className={id === value ? "selected" : ""}
          key={id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function Field({ label, children }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Link({ url, children }: any) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {children} ↗
    </a>
  );
}
