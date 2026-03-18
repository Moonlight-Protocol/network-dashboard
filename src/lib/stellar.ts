/**
 * Read-only Stellar/Soroban helpers for querying contract state.
 * No wallet, no signing — purely read operations.
 */
import { RPC_URL, HORIZON_URL } from "./config.ts";

// deno-lint-ignore no-explicit-any
let StellarSdk: any = null;

// deno-lint-ignore no-explicit-any
async function sdk(): Promise<any> {
  if (!StellarSdk) {
    StellarSdk = await import("stellar-sdk");
  }
  return StellarSdk;
}

// deno-lint-ignore no-explicit-any
async function getRpcServer(): Promise<any> {
  const stellar = await sdk();
  return new stellar.rpc.Server(RPC_URL);
}

/**
 * Query a Privacy Channel contract for its supply.
 */
export async function getChannelSupply(contractId: string): Promise<bigint> {
  try {
    const stellar = await sdk();
    const server = await getRpcServer();
    const contract = new stellar.Contract(contractId);

    const account = await simulateReadCall(server, stellar, contract, "supply");
    return BigInt(account);
  } catch {
    return 0n;
  }
}

/**
 * Query a Privacy Channel contract for its asset address.
 */
export async function getChannelAsset(contractId: string): Promise<string> {
  try {
    const stellar = await sdk();
    const server = await getRpcServer();
    const contract = new stellar.Contract(contractId);

    return await simulateReadCall(server, stellar, contract, "asset");
  } catch {
    return "unknown";
  }
}

/**
 * Simulate a read-only contract call (no signing needed).
 */
// deno-lint-ignore no-explicit-any
async function simulateReadCall(server: any, stellar: any, contract: any, method: string): Promise<any> {
  // Use a dummy source account for simulation
  const sourceKey = stellar.Keypair.random();
  const sourcePublicKey = sourceKey.publicKey();

  // Build a dummy account for simulation
  const account = new stellar.Account(sourcePublicKey, "0");

  const tx = new stellar.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: "Test SDF Network ; September 2015",
  })
    .addOperation(contract.call(method))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (sim.error) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  // Extract return value from simulation result
  if (sim.result?.retval) {
    return stellar.scValToNative(sim.result.retval);
  }

  return null;
}

/**
 * Get contract events (ProviderAdded, ProviderRemoved, transact) from RPC.
 */
export async function getContractEvents(
  contractId: string,
  startLedger?: number,
  limit = 100,
): Promise<ContractEvent[]> {
  const server = await getRpcServer();
  const stellar = await sdk();

  try {
    const latestLedger = await server.getLatestLedger();
    const start = startLedger ?? Math.max(1, latestLedger.sequence - 17280); // ~24h of ledgers

    const response = await server.getEvents({
      startLedger: start,
      filters: [
        {
          type: "contract",
          contractIds: [contractId],
        },
      ],
      limit,
    });

    return (response.events ?? []).map((e: RawEvent) => ({
      id: e.id,
      type: parseEventType(e, stellar),
      contractId: e.contractId ?? contractId,
      ledger: e.ledger,
      timestamp: e.createdAt,
      topic: e.topic?.map((t: unknown) => {
        try { return stellar.scValToNative(t); }
        catch { return String(t); }
      }) ?? [],
      value: e.value ? safeScValToNative(stellar, e.value) : null,
    }));
  } catch {
    return [];
  }
}

interface RawEvent {
  id: string;
  contractId?: string;
  ledger: number;
  createdAt: string;
  topic?: unknown[];
  value?: unknown;
  type?: string;
}

// deno-lint-ignore no-explicit-any
function safeScValToNative(stellar: any, val: unknown): unknown {
  try { return stellar.scValToNative(val); }
  catch { return String(val); }
}

// deno-lint-ignore no-explicit-any
function parseEventType(event: RawEvent, stellar: any): string {
  if (!event.topic || event.topic.length === 0) return "unknown";
  try {
    const first = stellar.scValToNative(event.topic[0]);
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

/**
 * Get recent transactions for a contract from Horizon.
 */
export async function getContractTransactions(
  contractId: string,
  limit = 20,
): Promise<HorizonTransaction[]> {
  try {
    const url = `${HORIZON_URL}/accounts/${contractId}/transactions?order=desc&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data._embedded?.records ?? []).map((r: HorizonTransactionRaw) => ({
      hash: r.hash,
      ledger: r.ledger,
      createdAt: r.created_at,
      sourceAccount: r.source_account,
      operationCount: r.operation_count,
      feeCharged: r.fee_charged,
      successful: r.successful,
    }));
  } catch {
    return [];
  }
}

interface HorizonTransactionRaw {
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  operation_count: number;
  fee_charged: string;
  successful: boolean;
}

export interface HorizonTransaction {
  hash: string;
  ledger: number;
  createdAt: string;
  sourceAccount: string;
  operationCount: number;
  feeCharged: string;
  successful: boolean;
}

/**
 * Get recent Soroban operations for a contract from Horizon.
 */
export async function getContractOperations(
  contractId: string,
  limit = 50,
): Promise<SorobanOperation[]> {
  try {
    const url = `${HORIZON_URL}/accounts/${contractId}/operations?order=desc&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data._embedded?.records ?? []).map((r: SorobanOperationRaw) => ({
      id: r.id,
      type: r.type,
      createdAt: r.created_at,
      sourceAccount: r.source_account,
      transactionHash: r.transaction_hash,
      function: r.function,
    }));
  } catch {
    return [];
  }
}

interface SorobanOperationRaw {
  id: string;
  type: string;
  created_at: string;
  source_account: string;
  transaction_hash: string;
  function?: string;
}

export interface SorobanOperation {
  id: string;
  type: string;
  createdAt: string;
  sourceAccount: string;
  transactionHash: string;
  function?: string;
}
