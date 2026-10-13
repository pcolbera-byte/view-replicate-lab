// Documentos em PDF com a marca: resumo da apólice e ficha do cliente.
import type { useWorkspace } from "@/components/app/workspace-context";
import type { Apolice } from "@/lib/data/types";
import { dateBR, money } from "@/lib/format";
import { isActivePolicy, policyStatus, premioAtual } from "@/lib/domain";
import { dadosDoRamo, resumoDoRamo } from "@/lib/ramos";
import { detalhesEndosso, nomeVeiculo } from "@/lib/endossos";
import type { Endosso } from "@/lib/data/types";
import type { Relatorio, Secao } from "@/lib/relatorio/exportar";

type Ctx = Pick<ReturnType<typeof useWorkspace>, "ws" | "get">;

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function contatoCorretora(ctx: Ctx): string {
  const e = ctx.ws.empresa;
  return [e.telefone || e.whatsapp, e.email].filter(Boolean).join(" · ");
}

function secaoSegurado(ctx: Ctx, clienteId: string): Secao {
  const c = ctx.get.cliente(clienteId);
  const endereco = c
    ? [
        [c.endereco, c.numero].filter(Boolean).join(", "),
        c.complemento,
        c.bairro,
        [c.cidade, c.estado].filter(Boolean).join("/"),
        c.cep ? `CEP ${c.cep}` : "",
      ]
        .filter(Boolean)
        .join(" – ")
    : "";
  return {
    titulo: "Segurado",
    campos: [
      ["Nome", s(c?.nome)],
      [c?.tipo === "PJ" ? "CNPJ" : "CPF", s(c?.documento)],
      ["Telefone", s(c?.whatsapp || c?.telefone)],
      ["E-mail", s(c?.email)],
      ["Endereço", endereco],
      ["Nascimento", c?.data_nascimento ? dateBR(c.data_nascimento) : ""],
    ],
  };
}

export function pdfApolice(ctx: Ctx, a: Apolice): Relatorio {
  const { ws, get } = ctx;
  const v = get.veiculo(a.veiculo_id);
  const endossos = ws.endossos
    .filter((e) => e.apolice_id === a.id)
    .sort((x, y) => x.data_emissao.localeCompare(y.data_emissao));
  const coberturas = ws.coberturas
    .filter((c) => c.apolice_id === a.id)
    .sort((x, y) => x.ordem - y.ordem);
  const parcelas = ws.parcelas
    .filter((p) => p.apolice_id === a.id)
    .sort((x, y) => x.numero - y.numero);
  const premio = premioAtual(a, ws.endossos);
  const secoes: Secao[] = [
    secaoSegurado(ctx, a.cliente_id),
    {
      titulo: "Apólice",
      campos: [
        ["Seguradora", a.seguradora],
        ["Número", a.numero],
        ["Ramo", a.ramo],
        ["Situação", policyStatus(a)],
        ["Início da vigência", dateBR(a.inicio)],
        ["Fim da vigência", dateBR(a.vencimento)],
        ["Prêmio total", money(a.premio)],
        ["Prêmio com endossos", premio !== Number(a.premio) ? money(premio) : ""],
        ["Forma de pagamento", s(a.forma_pagamento)],
        ["Parcelas", a.parcelas_qtd ? String(a.parcelas_qtd) : ""],
        ["Franquia", a.franquia != null ? money(a.franquia) : ""],
      ],
    },
  ];
  if (v)
    secoes.push({
      titulo: "Veículo",
      campos: [
        ["Veículo", `${v.marca} ${v.modelo}`.trim()],
        ["Placa", v.placa],
        ["Ano", [v.ano_fabricacao, v.ano_modelo].filter(Boolean).join("/") || s(v.ano)],
        ["Chassi", s(v.chassi)],
        ["Renavam", s(v.renavam)],
        ["Uso", s(v.uso)],
        ["CEP de pernoite", s(v.cep_pernoite)],
        ["Valor FIPE", v.valor_fipe ? money(v.valor_fipe) : ""],
      ],
    });
  const ramo = dadosDoRamo(a);
  if (ramo.length) secoes.push({ titulo: `Dados do seguro ${a.ramo}`, campos: ramo });
  if (coberturas.length)
    secoes.push({
      titulo: "Coberturas",
      colunas: [
        { titulo: "Cobertura", largura: 40 },
        { titulo: "Limite (LMI)", tipo: "moeda", largura: 16 },
        { titulo: "Franquia", largura: 18 },
        { titulo: "Prêmio", tipo: "moeda", largura: 14 },
      ],
      linhas: coberturas.map((c) => [c.nome, c.limite, c.franquia, c.premio]),
    });
  if (endossos.length)
    secoes.push({
      titulo: "Endossos",
      colunas: [
        { titulo: "Emissão", tipo: "data", largura: 11 },
        { titulo: "Tipo", largura: 18 },
        { titulo: "Nº", largura: 10 },
        { titulo: "Descrição", largura: 38 },
        { titulo: "Dif. prêmio", tipo: "moeda", largura: 13 },
      ],
      linhas: endossos.map((e) => [
        e.data_emissao,
        e.tipo,
        e.numero,
        [...detalhesEndosso(e, get.veiculo).map(([k, v]) => `${k}: ${v}`), e.descricao]
          .filter(Boolean)
          .join("\n"),
        Number(e.premio_diferenca),
      ]),
    });
  if (parcelas.length)
    secoes.push({
      titulo: "Parcelas",
      colunas: [
        { titulo: "Parcela", tipo: "inteiro", largura: 8 },
        { titulo: "Vencimento", tipo: "data", largura: 12 },
        { titulo: "Valor", tipo: "moeda", largura: 12 },
        { titulo: "Situação", largura: 12 },
        { titulo: "Pagamento", tipo: "data", largura: 12 },
      ],
      linhas: parcelas.map((p) => [
        p.numero,
        p.vencimento,
        Number(p.valor),
        p.status,
        p.data_pagamento,
      ]),
    });
  const contato = contatoCorretora(ctx);
  secoes.push({
    texto: `Este resumo foi emitido pela corretora ${ws.empresa.nome}${contato ? ` – ${contato} –` : ""} e não substitui a apólice emitida pela seguradora, que prevalece em caso de divergência.`,
  });
  return {
    titulo: "Resumo da apólice",
    subtitulo: `${get.clienteNome(a.cliente_id)} · ${a.seguradora} nº ${a.numero} · ${v ? `${v.marca} ${v.modelo} ${v.placa}` : resumoDoRamo(a)}`,
    empresa: ws.empresa.nome,
    arquivo: `apolice-${a.seguradora}-${a.numero}`,
    paisagem: false,
    resumo: [
      ["Vigência", `${dateBR(a.inicio)} a ${dateBR(a.vencimento)}`],
      ["Prêmio", money(premio)],
      ["Situação", policyStatus(a)],
    ],
    secoes,
  };
}

export function pdfCliente(ctx: Ctx, clienteId: string): Relatorio {
  const { ws, get } = ctx;
  const c = get.cliente(clienteId);
  const apolices = ws.apolices
    .filter((a) => a.cliente_id === clienteId)
    .sort((x, y) => y.vencimento.localeCompare(x.vencimento));
  const vigentes = apolices.filter(isActivePolicy);
  const veiculos = ws.veiculos.filter((v) => v.cliente_id === clienteId);
  const sinistros = ws.sinistros.filter((x) => x.cliente_id === clienteId);
  const secoes: Secao[] = [
    secaoSegurado(ctx, clienteId),
    {
      titulo: "Cadastro",
      campos: [
        ["Tipo", c?.tipo === "PJ" ? "Pessoa jurídica" : "Pessoa física"],
        ["Nome fantasia", s(c?.nome_fantasia)],
        ["RG", s(c?.rg)],
        ["Estado civil", s(c?.estado_civil)],
        ["Responsável (PJ)", s(c?.responsavel_nome)],
        ["Produtor", c?.produtor_id ? get.produtorNome(c.produtor_id) : ""],
        ["Cliente desde", c ? dateBR(c.created_at) : ""],
        ["Observações", s(c?.observacoes)],
      ],
    },
  ];
  if (apolices.length)
    secoes.push({
      titulo: "Apólices",
      colunas: [
        { titulo: "Seguradora", largura: 14 },
        { titulo: "Número", largura: 13 },
        { titulo: "Ramo / item", largura: 28 },
        { titulo: "Início", tipo: "data", largura: 11 },
        { titulo: "Fim", tipo: "data", largura: 11 },
        { titulo: "Prêmio", tipo: "moeda", largura: 13 },
        { titulo: "Situação", largura: 11 },
      ],
      linhas: apolices.map((a) => {
        const v = get.veiculo(a.veiculo_id);
        return [
          a.seguradora,
          a.numero,
          v ? `${a.ramo} – ${v.marca} ${v.modelo} ${v.placa}` : resumoDoRamo(a),
          a.inicio,
          a.vencimento,
          premioAtual(a, ws.endossos),
          policyStatus(a),
        ];
      }),
    });
  if (veiculos.length)
    secoes.push({
      titulo: "Veículos",
      colunas: [
        { titulo: "Veículo", largura: 30 },
        { titulo: "Placa", largura: 11 },
        { titulo: "Ano", largura: 10 },
        { titulo: "Chassi", largura: 20 },
        { titulo: "Uso", largura: 14 },
      ],
      linhas: veiculos.map((v) => [
        `${v.marca} ${v.modelo}`.trim(),
        v.placa,
        [v.ano_fabricacao, v.ano_modelo].filter(Boolean).join("/") || s(v.ano),
        v.chassi,
        v.uso,
      ]),
    });
  if (sinistros.length)
    secoes.push({
      titulo: "Sinistros",
      colunas: [
        { titulo: "Data", tipo: "data", largura: 11 },
        { titulo: "Tipo", largura: 16 },
        { titulo: "Protocolo", largura: 14 },
        { titulo: "Situação", largura: 12 },
        { titulo: "Descrição", largura: 40 },
      ],
      linhas: sinistros.map((x) => [x.data, x.tipo, x.protocolo, x.status, x.descricao]),
    });
  return {
    titulo: "Ficha do cliente",
    subtitulo: c?.nome ?? "",
    empresa: ws.empresa.nome,
    arquivo: `cliente-${c?.nome ?? clienteId}`,
    paisagem: false,
    resumo: [
      ["Apólices vigentes", String(vigentes.length)],
      ["Prêmios vigentes", money(vigentes.reduce((t, a) => t + premioAtual(a, ws.endossos), 0))],
      ["Veículos", String(veiculos.length)],
      ["Sinistros", String(sinistros.length)],
    ],
    secoes,
  };
}

/** Comprovante de um endosso, para enviar ao cliente. */
export function pdfEndosso(ctx: Ctx, e: Endosso): Relatorio | null {
  const { ws, get } = ctx;
  const a = get.apolice(e.apolice_id);
  if (!a) return null;
  const novo = get.veiculo(e.veiculo_id);
  const parcelas = ws.parcelas
    .filter((p) => p.endosso_id === e.id)
    .sort((x, y) => x.numero - y.numero);
  const secoes: Secao[] = [
    secaoSegurado(ctx, a.cliente_id),
    {
      titulo: "Apólice",
      campos: [
        ["Seguradora", a.seguradora],
        ["Número", a.numero],
        ["Ramo", a.ramo],
        ["Vigência", `${dateBR(a.inicio)} a ${dateBR(a.vencimento)}`],
      ],
    },
    {
      titulo: "Endosso",
      campos: [
        ["Tipo", e.tipo],
        ["Número", e.numero],
        ["Emissão", dateBR(e.data_emissao)],
        ["Vigência a partir de", e.inicio_vigencia ? dateBR(e.inicio_vigencia) : ""],
        ["Diferença de prêmio", money(e.premio_diferenca)],
        ["Prêmio da apólice após o endosso", money(premioAtual(a, ws.endossos))],
        ...detalhesEndosso(e, get.veiculo).filter(([k]) => k !== "Novo veículo"),
      ],
    },
  ];
  if (novo)
    secoes.push({
      titulo: "Novo veículo",
      campos: [
        ["Veículo", nomeVeiculo(novo)],
        ["Ano", [novo.ano_fabricacao, novo.ano_modelo].filter(Boolean).join("/") || s(novo.ano)],
        ["Chassi", s(novo.chassi)],
        ["Renavam", s(novo.renavam)],
        ["Combustível", s(novo.combustivel)],
        ["Uso", s(novo.uso)],
        ["CEP de pernoite", s(novo.cep_pernoite)],
        ["Local de guarda", s(novo.local_guarda)],
        ["Valor FIPE", novo.valor_fipe ? money(novo.valor_fipe) : ""],
      ],
    });
  if (parcelas.length)
    secoes.push({
      titulo: "Parcelas da diferença",
      colunas: [
        { titulo: "Parcela", largura: 10 },
        { titulo: "Vencimento", tipo: "data", largura: 14 },
        { titulo: "Valor", tipo: "moeda", largura: 14 },
        { titulo: "Situação", largura: 14 },
      ],
      linhas: parcelas.map((p, i) => [
        `${i + 1}/${parcelas.length}`,
        p.vencimento,
        Number(p.valor),
        p.status,
      ]),
    });
  if (e.descricao) secoes.push({ titulo: "Observações", texto: e.descricao });
  const contato = contatoCorretora(ctx);
  secoes.push({
    texto: `Comprovante emitido pela corretora ${ws.empresa.nome}${contato ? ` – ${contato} –` : ""}. O endosso emitido pela seguradora prevalece em caso de divergência.`,
  });
  return {
    titulo: `Endosso – ${e.tipo}`,
    subtitulo: `${get.clienteNome(a.cliente_id)} · ${a.seguradora} nº ${a.numero}${e.numero ? ` · endosso nº ${e.numero}` : ""}`,
    empresa: ws.empresa.nome,
    arquivo: `endosso-${a.numero}-${e.numero || e.data_emissao}`,
    paisagem: false,
    secoes,
  };
}
