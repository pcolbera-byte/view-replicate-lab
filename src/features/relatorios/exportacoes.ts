// Relatórios exportáveis (PDF e Excel): relação de renovações e produção.
import type { useWorkspace } from "@/components/app/workspace-context";
import type { Apolice } from "@/lib/data/types";
import { daysUntil, money } from "@/lib/format";
import type { Coluna, Relatorio, Valor } from "@/lib/relatorio/exportar";
import { SEM_PRODUTOR, participacao } from "@/features/produtores/produtores";

type Ctx = Pick<ReturnType<typeof useWorkspace>, "ws" | "get">;

/** Situação da renovação, em texto (igual às telas). */
export function situacaoRenovacao(a: Apolice): string {
  if (a.status === "Cancelada") return "Cancelada";
  if (a.status === "Renovada" || a.renovacao_status === "Renovada") return "Renovada";
  if (a.renovacao_status === "Não renovada" || a.status === "Encerrada") return "Não renovada";
  return a.renovacao_status === "Em negociação" ? "Em negociação" : "A renovar";
}

export const comissaoDaApolice = (a: Apolice) =>
  a.comissao_valor !== null && a.comissao_valor !== undefined
    ? Number(a.comissao_valor)
    : Math.round(Number(a.premio || 0) * Number(a.comissao_percentual || 0)) / 100;

const itemSegurado = (ctx: Ctx, a: Apolice) => {
  const v = ctx.get.veiculo(a.veiculo_id);
  return v ? `${v.marca} ${v.modelo} ${v.placa}`.replace(/\s+/g, " ").trim() : a.ramo || "";
};

const produtoresDaApolice = (ctx: Ctx, a: Apolice) => {
  const r = ctx.get.rateio(a.id);
  if (r.length > 1)
    return r
      .map(
        (x) => `${ctx.get.produtorNome(x.produtor_id)} ${String(x.percentual).replace(".", ",")}%`,
      )
      .join(" / ");
  if (a.produtor_id) return ctx.get.produtorNome(a.produtor_id);
  return ctx.get.usuarioNome(a.responsavel_id).replace("—", "");
};

const soma = (xs: number[]) => Math.round(xs.reduce((t, x) => t + x, 0) * 100) / 100;
const mesLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
};

// ---------------------------------------------------------------- Renovações
export function relatorioRenovacoes(
  ctx: Ctx,
  apolices: Apolice[],
  opts: { titulo?: string; subtitulo: string; arquivo: string },
): Relatorio {
  const lista = [...apolices].sort(
    (a, b) =>
      a.vencimento.localeCompare(b.vencimento) ||
      ctx.get.clienteNome(a.cliente_id).localeCompare(ctx.get.clienteNome(b.cliente_id)),
  );
  const colunas: Coluna[] = [
    { titulo: "Vencimento", tipo: "data", largura: 11 },
    { titulo: "Dias", tipo: "inteiro", largura: 6 },
    { titulo: "Cliente", largura: 28 },
    { titulo: "CPF/CNPJ", largura: 17 },
    { titulo: "Telefone", largura: 15 },
    { titulo: "Seguradora", largura: 16 },
    { titulo: "Apólice", largura: 15 },
    { titulo: "Item segurado", largura: 24 },
    { titulo: "Prêmio", tipo: "moeda", largura: 13 },
    { titulo: "Produtor", largura: 16 },
    { titulo: "Situação", largura: 13 },
  ];
  const linhas: Valor[][] = lista.map((a) => {
    const c = ctx.get.cliente(a.cliente_id);
    const sit = situacaoRenovacao(a);
    return [
      a.vencimento,
      sit === "A renovar" || sit === "Em negociação" ? daysUntil(a.vencimento) : "",
      c?.nome ?? "",
      c?.documento ?? "",
      c?.whatsapp || c?.telefone || "",
      a.seguradora,
      a.numero,
      itemSegurado(ctx, a),
      Number(a.premio || 0),
      produtoresDaApolice(ctx, a),
      sit,
    ];
  });
  const conta = (s: string) => lista.filter((a) => situacaoRenovacao(a) === s).length;
  const validas = lista.filter((a) => situacaoRenovacao(a) !== "Cancelada");
  const renovadas = conta("Renovada");
  const encerradas = renovadas + conta("Não renovada");
  return {
    titulo: opts.titulo ?? "Relação de renovações",
    subtitulo: opts.subtitulo,
    empresa: ctx.ws.empresa.nome,
    arquivo: opts.arquivo,
    resumo: [
      ["Apólices", String(validas.length)],
      ["Prêmios", money(soma(validas.map((a) => Number(a.premio || 0))))],
      ["A renovar", String(conta("A renovar") + conta("Em negociação"))],
      ["Renovadas", String(renovadas)],
      ["Não renovadas", String(conta("Não renovada"))],
      ["Aproveitamento", encerradas ? `${Math.round((renovadas / encerradas) * 100)}%` : "—"],
    ],
    secoes: [
      {
        colunas,
        linhas,
        totais: [
          "Total",
          "",
          `${lista.length} apólice(s)`,
          "",
          "",
          "",
          "",
          "",
          soma(lista.map((a) => Number(a.premio || 0))),
          "",
          "",
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------- Produção
export function relatorioProducao(
  ctx: Ctx,
  apolices: Apolice[],
  opts: { subtitulo: string; arquivo: string; produtor?: string | undefined },
): Relatorio {
  const { ws, get } = ctx;
  const lista = apolices
    .filter((a) => a.status !== "Cancelada")
    .sort(
      (a, b) =>
        a.inicio.localeCompare(b.inicio) ||
        get.clienteNome(a.cliente_id).localeCompare(get.clienteNome(b.cliente_id)),
    );
  // Quando filtrado por um produtor, prêmio e comissão contam pela participação dele.
  const peso = (a: Apolice) =>
    !opts.produtor
      ? 1
      : opts.produtor === SEM_PRODUTOR
        ? 1
        : participacao(a, opts.produtor, get.rateio) || 1;
  const premio = (a: Apolice) => Number(a.premio || 0) * peso(a);
  const comissao = (a: Apolice) => comissaoDaApolice(a) * peso(a);
  const tipo = (a: Apolice) => (a.apolice_anterior_id ? "Renovação" : "Nova");

  const detalhado = {
    titulo: "Apólices emitidas",
    colunas: [
      { titulo: "Início", tipo: "data", largura: 11 },
      { titulo: "Cliente", largura: 28 },
      { titulo: "Seguradora", largura: 16 },
      { titulo: "Apólice", largura: 15 },
      { titulo: "Item segurado / ramo", largura: 24 },
      { titulo: "Tipo", largura: 11 },
      { titulo: "Prêmio", tipo: "moeda", largura: 13 },
      { titulo: "Com. %", tipo: "numero", largura: 8 },
      { titulo: "Comissão", tipo: "moeda", largura: 13 },
      { titulo: "Produtor", largura: 20 },
    ] satisfies Coluna[],
    linhas: lista.map((a): Valor[] => [
      a.inicio,
      get.clienteNome(a.cliente_id),
      a.seguradora,
      a.numero,
      itemSegurado(ctx, a),
      tipo(a),
      premio(a),
      a.comissao_percentual === null ? null : Number(a.comissao_percentual),
      comissao(a),
      produtoresDaApolice(ctx, a),
    ]),
    totais: [
      "Total",
      `${lista.length} apólice(s)`,
      "",
      "",
      "",
      "",
      soma(lista.map(premio)),
      "",
      soma(lista.map(comissao)),
      "",
    ] as Valor[],
  };

  // Agrupamentos
  const agrupar = (chave: (a: Apolice) => string) => {
    const m = new Map<string, Apolice[]>();
    for (const a of lista) m.set(chave(a), [...(m.get(chave(a)) ?? []), a]);
    return m;
  };
  const totalPremio = soma(lista.map(premio));
  const pct = (v: number) => (totalPremio ? Math.round((v / totalPremio) * 10000) / 100 : 0);

  const porSeguradora = [...agrupar((a) => a.seguradora || "—").entries()]
    .map(([nome, xs]) => {
      const p = soma(xs.map(premio));
      return [
        nome,
        xs.length,
        xs.filter((a) => !a.apolice_anterior_id).length,
        xs.filter((a) => a.apolice_anterior_id).length,
        p,
        soma(xs.map(comissao)),
        pct(p),
      ] as Valor[];
    })
    .sort((a, b) => Number(b[4]) - Number(a[4]));

  const porMes = [...agrupar((a) => a.inicio.slice(0, 7)).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, xs]) => [
      mesLabel(ym),
      xs.length,
      xs.filter((a) => !a.apolice_anterior_id).length,
      xs.filter((a) => a.apolice_anterior_id).length,
      soma(xs.map(premio)),
      soma(xs.map(comissao)),
    ]);

  const porProdutor: Valor[][] = [];
  if (!opts.produtor && ws.temProdutores && ws.produtores.length) {
    for (const id of [...ws.produtores.map((p) => p.id), SEM_PRODUTOR]) {
      let n = 0,
        p = 0,
        c = 0;
      for (const a of lista) {
        const w = id === SEM_PRODUTOR ? (a.produtor_id ? 0 : 1) : participacao(a, id, get.rateio);
        if (!w) continue;
        n++;
        p += Number(a.premio || 0) * w;
        c += comissaoDaApolice(a) * w;
      }
      if (n)
        porProdutor.push([
          id === SEM_PRODUTOR ? "Sem produtor" : get.produtorNome(id),
          n,
          soma([p]),
          soma([c]),
          pct(p),
        ]);
    }
    porProdutor.sort((a, b) => Number(b[2]) - Number(a[2]));
  }

  const novas = lista.filter((a) => !a.apolice_anterior_id).length;
  return {
    titulo: "Relatório de produção",
    subtitulo: opts.subtitulo,
    empresa: ws.empresa.nome,
    arquivo: opts.arquivo,
    paisagem: true,
    resumo: [
      ["Apólices", String(lista.length)],
      ["Novas", String(novas)],
      ["Renovações", String(lista.length - novas)],
      ["Prêmios", money(totalPremio)],
      ["Comissões", money(soma(lista.map(comissao)))],
      ["Prêmio médio", money(lista.length ? totalPremio / lista.length : 0)],
    ],
    secoes: [
      detalhado,
      {
        titulo: "Por seguradora",
        colunas: [
          { titulo: "Seguradora", largura: 30 },
          { titulo: "Apólices", tipo: "inteiro", largura: 10 },
          { titulo: "Novas", tipo: "inteiro", largura: 10 },
          { titulo: "Renovações", tipo: "inteiro", largura: 11 },
          { titulo: "Prêmio", tipo: "moeda", largura: 16 },
          { titulo: "Comissão", tipo: "moeda", largura: 16 },
          { titulo: "% do prêmio", tipo: "numero", largura: 11 },
        ],
        linhas: porSeguradora,
      },
      ...(porProdutor.length
        ? [
            {
              titulo: "Por produtor",
              colunas: [
                { titulo: "Produtor", largura: 30 },
                { titulo: "Apólices", tipo: "inteiro", largura: 10 },
                { titulo: "Prêmio (participação)", tipo: "moeda", largura: 18 },
                { titulo: "Comissão (participação)", tipo: "moeda", largura: 18 },
                { titulo: "% do prêmio", tipo: "numero", largura: 11 },
              ] satisfies Coluna[],
              linhas: porProdutor,
            },
          ]
        : []),
      {
        titulo: "Por mês",
        colunas: [
          { titulo: "Mês", largura: 12 },
          { titulo: "Apólices", tipo: "inteiro", largura: 10 },
          { titulo: "Novas", tipo: "inteiro", largura: 10 },
          { titulo: "Renovações", tipo: "inteiro", largura: 11 },
          { titulo: "Prêmio", tipo: "moeda", largura: 16 },
          { titulo: "Comissão", tipo: "moeda", largura: 16 },
        ],
        linhas: porMes,
      },
    ],
  };
}
