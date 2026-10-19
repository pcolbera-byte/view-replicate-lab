// Integração com o Mercado Pago (assinaturas / "preapproval"). Só roda no servidor.
// Segredos (Lovable Cloud → Secrets):
//   MERCADOPAGO_ACCESS_TOKEN   – credencial de produção (ou de teste) da sua conta Mercado Pago
//   MERCADOPAGO_WEBHOOK_SECRET – "assinatura secreta" das notificações (Webhooks) — opcional, recomendada
import { PLANO } from "@/lib/plano";

const API = () => process.env["MERCADOPAGO_API_URL"] ?? "https://api.mercadopago.com";

function token(): string {
  const t = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!t)
    throw new Error(
      "A cobrança ainda não está configurada (falta o segredo MERCADOPAGO_ACCESS_TOKEN no servidor).",
    );
  return t;
}

async function mp<T>(path: string, init?: RequestInit & { idempotencia?: string }): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token()}`,
    "Content-Type": "application/json",
  };
  if (init?.idempotencia) headers["X-Idempotency-Key"] = init.idempotencia;
  const res = await fetch(`${API()}${path}`, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    console.error("[mercadopago]", res.status, path, body);
    throw new Error(
      `Mercado Pago recusou a operação (${res.status})${body.message ? `: ${body.message}` : ""}.`,
    );
  }
  return body;
}

export type Preapproval = {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  init_point?: string;
  external_reference?: string;
  payer_email?: string;
  next_payment_date?: string | null;
  auto_recurring?: { transaction_amount?: number; start_date?: string };
};

export type AuthorizedPayment = {
  id: number | string;
  preapproval_id: string;
  status?: string;
  date_created?: string;
  last_modified?: string;
  payment?: { id?: number; status?: string; status_detail?: string } | null;
};

export function criarPreapproval(opts: {
  empresaId: string;
  email: string;
  voltarPara: string;
  inicio: Date | null;
}): Promise<Preapproval> {
  return mp<Preapproval>("/preapproval", {
    method: "POST",
    idempotencia: `${opts.empresaId}-${Date.now()}`,
    body: JSON.stringify({
      reason: `${PLANO.nome} — assinatura mensal`,
      external_reference: opts.empresaId,
      payer_email: opts.email,
      back_url: opts.voltarPara,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: PLANO.valor,
        currency_id: "BRL",
        ...(opts.inicio ? { start_date: opts.inicio.toISOString() } : {}),
      },
    }),
  });
}

export const buscarPreapproval = (id: string) =>
  mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`);

export const cancelarPreapproval = (id: string) =>
  mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });

export const buscarPagamentoAutorizado = (id: string) =>
  mp<AuthorizedPayment>(`/authorized_payments/${encodeURIComponent(id)}`);

const STATUS: Record<Preapproval["status"], string> = {
  pending: "pendente",
  authorized: "ativa",
  paused: "atrasada",
  cancelled: "cancelada",
};

/** Campos da tabela assinaturas a partir da assinatura no Mercado Pago (a fonte da verdade). */
export function camposDaPreapproval(p: Preapproval): Record<string, unknown> {
  const proxima = p.next_payment_date ? p.next_payment_date.slice(0, 10) : null;
  return {
    mp_preapproval_id: p.id,
    mp_status: p.status,
    status: STATUS[p.status] ?? "pendente",
    valor: p.auto_recurring?.transaction_amount ?? null,
    proxima_cobranca: proxima,
    ...(p.status === "authorized" && proxima ? { pago_ate: proxima } : {}),
    ...(p.status === "cancelled" ? { cancelada_em: new Date().toISOString() } : {}),
  };
}

/** Confere a assinatura das notificações (header x-signature), quando o segredo existe. */
export async function notificacaoValida(request: Request, dataId: string): Promise<boolean> {
  const segredo = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
  if (!segredo) return true; // sem segredo: os dados são sempre reconsultados no Mercado Pago
  const sig = request.headers.get("x-signature") ?? "";
  const reqId = request.headers.get("x-request-id") ?? "";
  const partes = Object.fromEntries(
    sig.split(",").map((p) => p.split("=").map((x) => x.trim()) as [string, string]),
  );
  if (!partes["ts"] || !partes["v1"]) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifesto = `id:${id};request-id:${reqId};ts:${partes["ts"]};`;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const esperado = createHmac("sha256", segredo).update(manifesto).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(partes["v1"]);
  return a.length === b.length && timingSafeEqual(a, b);
}
