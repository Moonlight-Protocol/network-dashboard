/**
 * Display formatters shared across the 5-section layout. Kept separate
 * from `dom.ts` (which holds DOM helpers like truncateAddress) so the
 * presentation logic stays grouped.
 */

import { formatAmount } from "./dom.ts";

/**
 * Compact formatter for the counter strip (1.2K, 38.4M). For sub-thousand
 * values it returns the plain number; counters are always integers.
 */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 1_000) return Math.round(n).toLocaleString();
  if (Math.abs(n) < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

/**
 * Latency tile copy. Backend reports null while no live samples are in
 * window — we surface that as "—" rather than a misleading 0.
 */
export function formatLatencyMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  return `${(ms / 1_000).toFixed(1)} s`;
}

/**
 * Whole-asset display from stroops (string-encoded for int64 safety).
 * Two decimal places — sparkline and asset breakdown both render at this
 * resolution.
 */
export function formatStroops(amountStroops: string): string {
  return formatAmount(amountStroops);
}

/**
 * Format a percentage to one decimal place: 12.3%.
 */
export function formatPercent(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  return `${pct.toFixed(1)}%`;
}

/**
 * "Deployed Nd ago" / "Nh ago" copy for the council details panel header.
 * Falls back to the raw ISO if parsing fails.
 */
export function deployedAge(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const diffSec = Math.floor((Date.now() - ms) / 1_000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3_600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3_600)}h ago`;
  return `${Math.floor(diffSec / 86_400)}d ago`;
}
