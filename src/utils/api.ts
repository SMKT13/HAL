const KEY = "hal_viewer_session";
export function viewerKey() {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}
export function setViewerKey(value: string) {
  sessionStorage.setItem(KEY, value.trim());
}
export async function api(path: string, body?: any) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      "X-HAL-Viewer-Key": viewerKey(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(body ? 120000 : 95000),
  });
  const json = await response.json();
  if (!response.ok) throw Error(json.error || "Request failed.");
  return json;
}
export function money(n: any) {
  return typeof n === "number" && Number.isFinite(n)
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(n)
    : "—";
}
export function number(n: any, digits = 1) {
  return typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-IN", { maximumFractionDigits: digits })
    : "—";
}
export function when(t: any) {
  return t && Number.isFinite(Date.parse(t))
    ? new Date(t).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " IST"
    : "Time unavailable";
}
