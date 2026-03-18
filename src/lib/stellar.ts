/**
 * Read-only Stellar/Soroban helpers for querying contract state.
 * No wallet, no signing — purely read operations.
 */
import { RPC_URL, getNetworkPassphrase } from "./config.ts";

const REQUEST_TIMEOUT_MS = 15_000;

/** Errors encountered during the current view's queries. Cleared on each navigation. */
export const queryErrors: { source: string; message: string; time: number }[] = [];

/** Generation counter to scope errors to the current view load. */
let queryGeneration = 0;

/** Clear accumulated query errors. Call at the start of each view load. */
export function clearQueryErrors(): void {
  queryErrors.length = 0;
  queryGeneration++;
}

function recordError(source: string, err: unknown, generation: number): void {
  // Discard errors from a previous view's in-flight requests
  if (generation !== queryGeneration) return;
  const message = err instanceof Error ? err.message : String(err);
  queryErrors.push({ source, message, time: Date.now() });
  if (queryErrors.length > 50) queryErrors.shift();
  console.warn(`[stellar:${source}]`, message);
}

/** Wrap a promise with a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// --- Stellar SDK types (subset used by this module) ---
// Note: hand-written to match @stellar/stellar-sdk@14.2.0.
// If the SDK API changes, these will need updating.

interface StellarSdkSubset {
  Contract: new (id: string) => StellarContract;
  Account: new (publicKey: string, sequence: string) => StellarAccount;
  TransactionBuilder: new (account: StellarAccount, opts: { fee: string; networkPassphrase: string }) => TxBuilder;
  scValToNative(val: unknown): unknown;
  rpc: {
    Server: new (url: string) => RpcServer;
  };
}

interface StellarContract {
  call(method: string, ...args: unknown[]): unknown;
}

// StellarAccount — used as opaque type passed to TransactionBuilder.
type StellarAccount = Record<string, unknown>;

interface TxBuilder {
  addOperation(op: unknown): TxBuilder;
  setTimeout(seconds: number): TxBuilder;
  build(): StellarTransaction;
}

interface StellarTransaction {
  toXDR(): string;
}

interface SimulationResult {
  error?: string;
  result?: { retval?: unknown };
}

interface RpcServer {
  simulateTransaction(tx: StellarTransaction): Promise<SimulationResult>;
  getLatestLedger(): Promise<{ sequence: number }>;
  getEvents(opts: EventsRequest): Promise<EventsResponse>;
}

interface EventsRequest {
  startLedger: number;
  filters: { type: string; contractIds: string[] }[];
  limit: number;
}

interface EventsResponse {
  events?: RawEvent[];
}

interface RawEvent {
  id: string;
  contractId?: string;
  ledger: number;
  createdAt: string;
  topic?: unknown[];
  value?: unknown;
}

// --- SDK lazy-loading ---

let stellarSdk: StellarSdkSubset | null = null;

// Constant dummy public key for read-only simulations (avoids generating random keys).
const DUMMY_PK = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

async function sdk(): Promise<StellarSdkSubset> {
  if (!stellarSdk) {
    // Runtime cast: we trust the SDK shape matches our interface for the
    // methods we use. A version mismatch will surface as a runtime error
    // on the first call, not silently.
    const mod = await import("stellar-sdk");
    stellarSdk = mod as unknown as StellarSdkSubset;
  }
  return stellarSdk;
}

async function getRpcServer(): Promise<RpcServer> {
  const s = await sdk();
  return new s.rpc.Server(RPC_URL);
}

// --- Public API ---

/**
 * Query a Privacy Channel contract for its supply.
 */
export async function getChannelSupply(contractId: string): Promise<bigint> {
  const gen = queryGeneration;
  try {
    const s = await sdk();
    const server = await getRpcServer();
    const contract = new s.Contract(contractId);
    const result = await withTimeout(
      simulateReadCall(server, s, contract, "supply"),
      REQUEST_TIMEOUT_MS,
      "getChannelSupply",
    );
    if (typeof result === "bigint") return result;
    if (typeof result === "number" && isFinite(result)) return BigInt(Math.trunc(result));
    if (typeof result === "string" && /^-?\d+$/.test(result)) return BigInt(result);
    throw new Error(`Unexpected supply type: ${typeof result}`);
  } catch (err) {
    recordError(`getChannelSupply(${contractId.slice(0, 8)})`, err, gen);
    return 0n;
  }
}

/**
 * Simulate a read-only contract call (no signing needed).
 */
async function simulateReadCall(
  server: RpcServer,
  s: StellarSdkSubset,
  contract: StellarContract,
  method: string,
): Promise<unknown> {
  const account = new s.Account(DUMMY_PK, "0");
  const passphrase = getNetworkPassphrase();

  const tx = new s.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: passphrase,
  })
    .addOperation(contract.call(method))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (sim.error) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  if (sim.result?.retval) {
    return s.scValToNative(sim.result.retval);
  }

  return null;
}

/**
 * Get contract events from RPC.
 *
 * Note: RPC event retention is limited (~24h of ledgers). Events older than
 * the retention window are not available. Provider counts derived from events
 * may be incomplete.
 */
export async function getContractEvents(
  contractId: string,
  startLedger?: number,
  limit = 100,
): Promise<ContractEvent[]> {
  const gen = queryGeneration;
  try {
    const server = await getRpcServer();
    const s = await sdk();

    const latestLedger = await withTimeout(
      server.getLatestLedger(),
      REQUEST_TIMEOUT_MS,
      "getLatestLedger",
    );
    const seq = latestLedger?.sequence;
    if (typeof seq !== "number" || !isFinite(seq) || seq <= 0) {
      throw new Error("Invalid latest ledger sequence");
    }
    const start = startLedger ?? Math.max(1, seq - 17280);

    const response = await withTimeout(
      server.getEvents({
        startLedger: start,
        filters: [{ type: "contract", contractIds: [contractId] }],
        limit,
      }),
      REQUEST_TIMEOUT_MS,
      "getEvents",
    );

    return (response.events ?? []).map((e: RawEvent) => ({
      id: e.id,
      type: parseEventType(e, s),
      contractId: e.contractId ?? contractId,
      ledger: e.ledger,
      timestamp: e.createdAt,
      topic: e.topic?.map((t: unknown) => safeScValToNative(s, t)) ?? [],
      value: e.value ? safeScValToNative(s, e.value) : null,
    }));
  } catch (err) {
    recordError(`getContractEvents(${contractId.slice(0, 8)})`, err, gen);
    return [];
  }
}

/**
 * Derive active provider list from a chronologically-ordered event stream.
 * Processes events in order so add→remove→re-add correctly shows as active.
 * Exported for testability.
 */
export function countProvidersFromEvents(events: ContractEvent[]): string[] {
  const state = new Map<string, boolean>(); // address → currently active

  for (const e of events) {
    const addr = e.value != null ? String(e.value) : null;
    if (!addr) continue;
    if (e.type === "ProviderAdded") state.set(addr, true);
    if (e.type === "ProviderRemoved") state.set(addr, false);
  }

  return [...state.entries()].filter(([, active]) => active).map(([addr]) => addr);
}

function safeScValToNative(s: StellarSdkSubset, val: unknown): unknown {
  try {
    const result = s.scValToNative(val);
    if (result !== null && typeof result === "object") {
      return JSON.stringify(result);
    }
    return result;
  } catch {
    return null;
  }
}

function parseEventType(event: RawEvent, s: StellarSdkSubset): string {
  if (!event.topic || event.topic.length === 0) return "unknown";
  try {
    const first = s.scValToNative(event.topic[0]);
    if (typeof first === "string") return first;
    return "unknown";
  } catch {
    return "unknown";
  }
}

export interface ContractEvent {
  id: string;
  type: string;
  contractId: string;
  ledger: number;
  timestamp: string;
  topic: unknown[];
  value: unknown;
}
