// Atualiza a tabela de assinaturas com o que está no Mercado Pago. Só roda no servidor
// (usa a chave de serviço do banco, que ignora o RLS).
import type { AuthorizedPayment, Preapproval } from "./mercadopago.server";
import { camposDaPreapproval } from "./mercadopago.server";

async function tabela() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // A tabela vem de uma migração nova; os tipos gerados podem ainda não conhecê-la.
  return supabaseAdmin.from("assinaturas" as "clientes");
}

type Linha = { empresa_id: string; status: string; mp_preapproval_id: string | null };

export async function lerAssinatura(empresaId: string): Promise<Linha & Record<string, unknown>> {
  const { data, error } = await (
    await tabela()
  )
    .select("*")
    .eq("empresa_id" as "id", empresaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Assinatura não encontrada para esta corretora.");
  return data as unknown as Linha & Record<string, unknown>;
}

export async function atualizarAssinatura(empresaId: string, campos: Record<string, unknown>) {
  const { error } = await (
    await tabela()
  )
    .update(campos as never)
    .eq("empresa_id" as "id", empresaId);
  if (error) throw new Error(error.message);
}

/** Grava o estado da assinatura do Mercado Pago na corretora indicada em external_reference. */
export async function salvarPreapproval(p: Preapproval): Promise<void> {
  const empresaId = p.external_reference;
  if (!empresaId) return;
  const atual = await lerAssinatura(empresaId).catch(() => null);
  if (!atual || atual.status === "isenta") return;
  // Uma assinatura antiga (ex.: clicou em assinar duas vezes) não sobrescreve a atual,
  // a não ser que seja a que foi paga.
  if (atual.mp_preapproval_id && atual.mp_preapproval_id !== p.id && p.status !== "authorized")
    return;
  await atualizarAssinatura(empresaId, camposDaPreapproval(p));
}

export async function registrarPagamento(ap: AuthorizedPayment): Promise<string | null> {
  const { data } = await (
    await tabela()
  )
    .select("empresa_id")
    .eq("mp_preapproval_id" as "id", ap.preapproval_id)
    .maybeSingle();
  const empresaId = (data as { empresa_id?: string } | null)?.empresa_id;
  if (!empresaId) return null;
  await atualizarAssinatura(empresaId, {
    ultimo_pagamento_em: ap.last_modified ?? ap.date_created ?? new Date().toISOString(),
    ultimo_pagamento_status: ap.payment?.status ?? ap.status ?? null,
  });
  return empresaId;
}
