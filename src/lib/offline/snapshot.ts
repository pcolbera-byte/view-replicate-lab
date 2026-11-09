// Cópia dos dados no próprio navegador (IndexedDB) para consultar sem internet.
// É gravada a cada carregamento bem-sucedido e apagada ao sair da conta.
import type { Workspace } from "@/lib/data/workspace";

const BANCO = "corretix-offline";
const LOJA = "snapshot";
const CHAVE = "ultimo";

export const MSG_OFFLINE =
  "Sem conexão: o Corretix está em modo consulta. Tente de novo quando a internet voltar.";

export type Snapshot = { userId: string; em: string; ws: Workspace };

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    if (typeof indexedDB === "undefined") return falha(new Error("sem IndexedDB"));
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error ?? new Error("IndexedDB"));
  });
}

async function operar<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, falha) => {
      const tx = db.transaction(LOJA, modo);
      const req = fn(tx.objectStore(LOJA));
      tx.oncomplete = () => ok(req.result);
      tx.onerror = () => falha(tx.error ?? new Error("IndexedDB"));
      tx.onabort = () => falha(tx.error ?? new Error("IndexedDB"));
    });
  } finally {
    db.close();
  }
}

export async function salvarSnapshot(ws: Workspace): Promise<void> {
  try {
    const { offlineDesde: _ignorar, ...dados } = ws;
    void _ignorar;
    const s: Snapshot = { userId: ws.userId, em: new Date().toISOString(), ws: dados as Workspace };
    await operar("readwrite", (l) => l.put(s, CHAVE));
  } catch (e) {
    console.warn("[offline] não foi possível guardar a cópia local", e);
  }
}

/** A última cópia guardada neste navegador (de quem entrou por último nele). */
export async function lerSnapshot(): Promise<Snapshot | null> {
  try {
    const s = await operar<Snapshot | undefined>("readonly", (l) => l.get(CHAVE));
    return s?.ws ? s : null;
  } catch {
    return null;
  }
}

export async function apagarSnapshot(): Promise<void> {
  try {
    await operar("readwrite", (l) => l.delete(CHAVE));
  } catch {
    /* sem IndexedDB: não há o que apagar */
  }
}

/** O erro parece falta de conexão (com a internet ou com o servidor)? */
export function semConexao(e?: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg =
    e instanceof Error
      ? `${e.name} ${e.message}`
      : typeof e === "object" && e
        ? `${(e as { name?: string }).name ?? ""} ${(e as { message?: string }).message ?? ""}`
        : String(e ?? "");
  return /failed to fetch|networkerror|load failed|fetch failed|network request failed|AuthRetryableFetchError|ERR_INTERNET|ERR_NAME_NOT_RESOLVED|timeout|\b50[234]\b/i.test(
    msg,
  );
}
