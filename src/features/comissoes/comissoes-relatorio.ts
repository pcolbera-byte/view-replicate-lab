// Relação de comissões (PDF e Excel) com os filtros da tela.
import type { useWorkspace } from "@/components/app/workspace-context";
import type { Comissao } from "@/lib/data/types";
import { daysUntil, money } from "@/lib/format";
import type { Relatorio } from "@/lib/relatorio/exportar";

type Ctx = Pick<ReturnType<typeof useWorkspace>, "ws" | "get">;

export function relatorioComissoes(ctx: Ctx, rows: Comissao[], periodo: string): Relatorio {
  const { ws, get } = ctx;
  const validas = rows.filter((c) => c.status !== "Cancelada");
  const soma = (xs: Comissao[], f: (c: Comissao) => number = (c) => Number(c.valor)) =>
    Math.round(xs.reduce((t, c) => t + f(c), 0) * 100) / 100;
  const recebidas = validas.filter((c) => c.status === "Recebida");
  const [de, ate] = periodo.split(" a ").map((m) => m.split("-").reverse().join("/"));
  return {
    titulo: "Relação de comissões",
    subtitulo: `Previsão de ${de} a ${ate}`,
    empresa: ws.empresa.nome,
    arquivo: `comissoes-${periodo.replace(/ /g, "")}`,
    resumo: [
      ["Prevista", money(soma(validas))],
      ["Recebida", money(soma(recebidas, (c) => Number(c.valor_recebido ?? c.valor)))],
      ["Pendente", money(soma(validas.filter((c) => c.status === "Prevista")))],
      [
        "Atrasada",
        money(
          soma(validas.filter((c) => c.status === "Prevista" && daysUntil(c.data_prevista) < 0)),
        ),
      ],
    ],
    secoes: [
      {
        colunas: [
          { titulo: "Previsto", tipo: "data", largura: 11 },
          { titulo: "Cliente", largura: 26 },
          { titulo: "Seguradora", largura: 15 },
          { titulo: "Apólice", largura: 14 },
          { titulo: "Parc.", largura: 6 },
          { titulo: "Produtor", largura: 15 },
          { titulo: "Valor", tipo: "moeda", largura: 12 },
          { titulo: "Situação", largura: 11 },
          { titulo: "Recebida em", tipo: "data", largura: 11 },
          { titulo: "Valor recebido", tipo: "moeda", largura: 12 },
        ],
        linhas: rows.map((c) => {
          const a = get.apolice(c.apolice_id);
          const late = c.status === "Prevista" && daysUntil(c.data_prevista) < 0;
          return [
            c.data_prevista,
            get.clienteNome(a?.cliente_id),
            a?.seguradora ?? "",
            a?.numero ?? "",
            c.parcela ?? (c.endosso_id ? "End." : ""),
            c.produtor_id ? get.produtorNome(c.produtor_id) : "",
            Number(c.valor),
            late ? "Atrasada" : c.status,
            c.data_recebida,
            c.status === "Recebida" ? Number(c.valor_recebido ?? c.valor) : null,
          ];
        }),
        totais: [
          "Total",
          `${rows.length} comissão(ões)`,
          "",
          "",
          "",
          "",
          soma(validas),
          "",
          "",
          soma(recebidas, (c) => Number(c.valor_recebido ?? c.valor)),
        ],
      },
    ],
  };
}
