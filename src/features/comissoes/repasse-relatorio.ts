// Extrato/recibo de repasse ao produtor (PDF e Excel).
import type { useWorkspace } from "@/components/app/workspace-context";
import type { Repasse } from "@/lib/data/types";
import { dateBR, money } from "@/lib/format";
import type { Relatorio } from "@/lib/relatorio/exportar";

type Ctx = ReturnType<typeof useWorkspace>;

export const mesLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${m}/${y}`;
};

export function relatorioRepasse(ctx: Pick<Ctx, "ws" | "get">, r: Repasse): Relatorio {
  const { ws, get } = ctx;
  const p = get.produtor(r.produtor_id);
  const itens = ws.repasse_itens.filter((i) => i.repasse_id === r.id);
  const com = new Map(ws.comissoes.map((c) => [c.id, c]));
  const linhas = itens
    .map((i) => {
      const c = com.get(i.comissao_id);
      const a = get.apolice(c?.apolice_id);
      return [
        a ? get.clienteNome(a.cliente_id) : "",
        a?.seguradora ?? "",
        a?.numero ?? "",
        c?.parcela ?? (c?.endosso_id ? "End." : ""),
        c?.data_recebida ?? "",
        Number(i.base),
        Number(i.percentual),
        Number(i.valor),
      ] as (string | number | null)[];
    })
    .sort((x, y) => String(x[0]).localeCompare(String(y[0])));
  const nome = p?.nome_completo || p?.nome || "Produtor";
  return {
    titulo: "Extrato de repasse de comissões",
    subtitulo: `${nome}${p?.documento ? ` · ${p.documento}` : ""} · competência ${mesLabel(r.competencia)}`,
    empresa: ws.empresa.nome,
    arquivo: `repasse-${p?.nome ?? "produtor"}-${r.competencia.slice(0, 7)}`,
    paisagem: true,
    resumo: [
      ["Total a repassar", money(r.valor)],
      ["Comissões", String(itens.length)],
      ["Situação", r.status === "Pago" ? "Pago" : "Em aberto"],
      [
        "Pago em",
        r.pago_em
          ? `${dateBR(r.pago_em)}${r.forma_pagamento ? ` (${r.forma_pagamento})` : ""}`
          : "—",
      ],
    ],
    secoes: [
      {
        colunas: [
          { titulo: "Cliente", largura: 28 },
          { titulo: "Seguradora", largura: 15 },
          { titulo: "Apólice", largura: 15 },
          { titulo: "Parcela", largura: 8 },
          { titulo: "Recebida em", tipo: "data", largura: 11 },
          { titulo: "Comissão", tipo: "moeda", largura: 13 },
          { titulo: "% repasse", tipo: "numero", largura: 9 },
          { titulo: "Repasse", tipo: "moeda", largura: 13 },
        ],
        linhas,
        totais: [
          "Total",
          "",
          "",
          "",
          "",
          Math.round(itens.reduce((t, i) => t + Number(i.base), 0) * 100) / 100,
          "",
          Number(r.valor),
        ],
      },
      ...(r.observacoes ? [{ texto: `Observações: ${r.observacoes}` }] : []),
    ],
    assinatura: {
      texto: `Declaro ter recebido de ${ws.empresa.nome} a importância de ${money(r.valor)}, referente ao repasse de comissões da competência ${mesLabel(r.competencia)}, conforme o extrato acima.`,
      nome: `${nome}${p?.documento ? ` – ${p.documento}` : ""}`,
    },
  };
}
