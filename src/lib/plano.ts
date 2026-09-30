// Plano de assinatura do Corretor360 (vendido pelo site). Altere o valor aqui: ele aparece na
// página inicial, na tela de assinatura e é o valor cobrado pelo Mercado Pago em novas assinaturas.
export const PLANO = {
  nome: "Corretor360 Completo",
  /** Valor mensal em reais. */
  valor: 39.9,
  testeDias: 14,
  /** Dias de tolerância após a data paga, antes de bloquear (cartão recusado, por exemplo). */
  toleranciaDias: 5,
} as const;

export type Assinatura = {
  empresa_id: string;
  status: "teste" | "pendente" | "ativa" | "atrasada" | "cancelada" | "isenta";
  teste_ate: string;
  pago_ate: string | null;
  valor: number | null;
  mp_preapproval_id: string | null;
  mp_status: string | null;
  proxima_cobranca: string | null;
  ultimo_pagamento_em: string | null;
  ultimo_pagamento_status: string | null;
  cancelada_em: string | null;
  created_at: string;
  updated_at: string;
};

const addDias = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Até quando a corretora pode usar o sistema (null = sem limite). */
export function liberadoAte(a: Assinatura | null): string | null {
  if (!a || a.status === "isenta" || a.status === "ativa") return null;
  const datas = [a.teste_ate];
  if (a.pago_ate) datas.push(addDias(a.pago_ate, PLANO.toleranciaDias));
  return datas.sort().at(-1) ?? a.teste_ate;
}

export function acessoLiberado(a: Assinatura | null, hoje: string): boolean {
  const ate = liberadoAte(a);
  return ate === null || hoje <= ate;
}

/** Dias restantes do teste grátis (0 no último dia; negativo se acabou). */
export function diasDeTeste(a: Assinatura, hoje: string): number {
  return Math.round(
    (Date.parse(`${a.teste_ate}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000,
  );
}

export const valorBR = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
