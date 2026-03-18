/**
 * Safe DOM helpers to avoid innerHTML XSS.
 */

export function renderError(container: HTMLElement, title: string, message: string): void {
  container.textContent = "";
  const h2 = document.createElement("h2");
  h2.textContent = title;
  const p = document.createElement("p");
  p.className = "error-text";
  p.textContent = "An error occurred. Please try again later.";
  container.append(h2, p);
  // Log actual error for debugging but don't expose to user
  console.warn(`[renderError] ${title}: ${message}`);
}

export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Format stroops (1/10^7) to human-readable amount.
 * Uses string-based division for values above Number.MAX_SAFE_INTEGER.
 */
export function formatAmount(stroops: bigint | number | string): string {
  let bi: bigint;
  if (typeof stroops === "bigint") {
    bi = stroops;
  } else if (typeof stroops === "number" && isFinite(stroops)) {
    bi = BigInt(Math.trunc(stroops));
  } else if (typeof stroops === "string") {
    try { bi = BigInt(stroops || "0"); } catch { bi = 0n; }
  } else {
    bi = 0n;
  }
  const whole = bi / 10_000_000n;
  const frac = bi % 10_000_000n;
  const fracStr = (frac < 0n ? -frac : frac).toString().padStart(7, "0").slice(0, 2);
  const wholeStr = whole.toLocaleString();
  return `${wholeStr}.${fracStr}`;
}

export function timeAgo(isoOrSeconds: string | number): string {
  const ts = typeof isoOrSeconds === "string" ? new Date(isoOrSeconds).getTime() : isoOrSeconds * 1000;
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Sanitize a URL for use in href attributes.
 * Only allows http: and https: schemes to prevent javascript: XSS.
 * Returns null for invalid/unsafe URLs.
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}
