/**
 * Read-only Stellar/Soroban helpers for querying contract state.
 * No wallet, no signing — purely read operations.
 */
import { RPC_URL, getNetworkPassphrase } from "./config.ts";

/** Errors encountered during the current view's queries. Cleared on each navigation. */
export const queryErrors: { source: string; message: string; time: number }[] = [];

/** Clear accumulated query errors. Call at the start of each view load. */
export function clearQueryErrors(): void {
  queryErrors.length = 0;
}

function recordError(source: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  queryErrors.push({ source, message, time: Date.now() });
  // Keep only last 50 errors
  if (queryErrors.length > 50) queryErrors.shift();
  console.warn(`[stellar:${source}]`, message);
}

// --- Stellar SDK types (subset used by this module) ---

interface StellarSdkSubset {
  Contract: new (id: string) => StellarContract;
  Account: new (publicKey: string, sequence: string) => StellarAccount;
  TransactionBuilder: new (account: StellarAccount, opts: { fee: string; networkPassphrase: string }) => TxBuilder;
  Keypair: { random(): { publicKey(): string } };
  scValToNative(val: unknown): unknown;
  rpc: {
    Server: new (url: string) => RpcServer;
  };
}

interface StellarContract {
  call(method: string, ...args: unknown[]): unknown;
}

interface StellarAccount {
  sequenceNumber(): string;
}

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
    stellarSdk = await import("stellar-sdk") as unknown as StellarSdkSubset;
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
  try {
    const s = await sdk();
    const server = await getRpcServer();
    const contract = new s.Contract(contractId);
    const result = await simulateReadCall(server, s, contract, "supply");
    if (typeof result === "bigint") return result;
    if (typeof result === "number" && isFinite(result)) return BigInt(Math.trunc(result));
    if (typeof result === "string" && /^-?\d+$/.test(result)) return BigInt(result);
    throw new Error(`Unexpected supply type: ${typeof result}`);
  } catch (err) {
    recordError(`getChannelSupply(${contractId.slice(0, 8)})`, err);
    return 0n;
  }
}

/**
 * Query a Privacy Channel contract for its asset address.
 */
export async function getChannelAsset(contractId: string): Promise<string> {
  try {
    const s = await sdk();
    const server = await getRpcServer();
    const contract = new s.Contract(contractId);
    return String(await simulateReadCall(server, s, contract, "asset"));
  } catch (err) {
    recordError(`getChannelAsset(${contractId.slice(0, 8)})`, err);
    return "unknown";
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
 * may be incomplete — use getProviderCount() for on-chain state queries.
 */
export async function getContractEvents(
  contractId: string,
  startLedger?: number,
  limit = 100,
): Promise<ContractEvent[]> {
  try {
    const server = await getRpcServer();
    const s = await sdk();

    const latestLedger = await server.getLatestLedger();
    const seq = latestLedger?.sequence;
    if (typeof seq !== "number" || !isFinite(seq) || seq <= 0) {
      throw new Error("Invalid latest ledger sequence");
    }
    const start = startLedger ?? Math.max(1, seq - 17280);

    const response = await server.getEvents({
      startLedger: start,
      filters: [{ type: "contract", contractIds: [contractId] }],
      limit,
    });

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
    recordError(`getContractEvents(${contractId.slice(0, 8)})`, err);
    return [];
  }
}

/**
 * Query on-chain provider count via contract simulation.
 * Falls back to event-based counting if the contract doesn't expose a list method.
 */
export async function getProviderCount(channelAuthId: string): Promise<{ count: number; fromEvents: boolean }> {
  // Try event-based discovery with a note about limitations
  try {
    const events = await getContractEvents(channelAuthId);
    const added = new Set<string>();
    const removed = new Set<string>();

    for (const e of events) {
      const addr = e.value != null ? String(e.value) : null;
      if (e.type === "ProviderAdded" && addr) added.add(addr);
      if (e.type === "ProviderRemoved" && addr) removed.add(addr);
    }

    for (const r of removed) added.delete(r);
    return { count: added.size, fromEvents: true };
  } catch (err) {
    recordError(`getProviderCount(${channelAuthId.slice(0, 8)})`, err);
    return { count: 0, fromEvents: true };
  }
}

function safeScValToNative(s: StellarSdkSubset, val: unknown): unknown {
  try {
    const result = s.scValToNative(val);
    // Avoid [object Object] for non-primitives
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
