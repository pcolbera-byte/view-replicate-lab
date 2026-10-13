// Textos de resumo de um endosso (lista da ficha, PDFs).
import type { Endosso, Veiculo } from "@/lib/data/types";
import { dateBR, money } from "@/lib/format";

export const nomeVeiculo = (v: Pick<Veiculo, "marca" | "modelo" | "placa"> | undefined) =>
  v ? `${v.marca} ${v.modelo} · ${v.placa}`.replace(/\s+/g, " ").trim() : "—";

export function detalhesEndosso(
  e: Endosso,
  veiculo: (id?: string | null) => Veiculo | undefined,
): [string, string][] {
  const d = (e.dados ?? {}) as Record<string, unknown>;
  const out: [string, string][] = [];
  if (e.veiculo_id) {
    out.push(["Veículo anterior", nomeVeiculo(veiculo(e.veiculo_anterior_id))]);
    out.push(["Novo veículo", nomeVeiculo(veiculo(e.veiculo_id))]);
  }
  if (Number(e.premio_diferenca) > 0 && (e.forma_pagamento || e.parcelas_qtd)) {
    const n = e.parcelas_qtd ?? 1;
    const parcela = Number(e.premio_diferenca) / n;
    out.push([
      "Pagamento da diferença",
      [
        e.forma_pagamento,
        `${n}x de ${money(parcela)}`,
        e.primeiro_vencimento ? `1º vencimento ${dateBR(e.primeiro_vencimento)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    ]);
  }
  if (typeof d["franquia_nova"] === "number") {
    const ant = d["franquia_anterior"];
    out.push([
      "Franquia",
      `${ant !== null && ant !== undefined && ant !== "" ? `${money(Number(ant))} → ` : ""}${money(d["franquia_nova"])}`,
    ]);
  }
  const texto = (k: string, rotulo: string) => {
    if (d[k] !== undefined && d[k] !== null && String(d[k]).trim())
      out.push([rotulo, String(d[k])]);
  };
  texto("condutor_principal", "Condutor principal");
  texto("cep_pernoite", "CEP de pernoite");
  texto("classe_bonus", "Classe de bônus");
  return out;
}
