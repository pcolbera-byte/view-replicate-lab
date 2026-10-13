// Regras da conciliação: lê as linhas do extrato da seguradora e encontra as comissões
// previstas correspondentes (mesma apólice e parcela), conferindo o valor.
import type { Apolice, Comissao } from "@/lib/data/types";
import { numeroBR, type Tabela } from "@/lib/planilha/ler";

export type Mapa = { apolice: number; valor: number; parcela: number; nome: number };
export type Situacao = "ok" | "divergente" | "nao_encontrada" | "ja_recebida" | "invalida";
export type LinhaConciliacao = {
  indice: number;
  apoliceTxt: string;
  parcela: number | null;
  nome: string;
  valor: number | null;
  situacao: Situacao;
  apolice?: Apolice | undefined;
  /** Comissões previstas que a linha quita (várias quando há rateio entre produtores). */
  comissoes: Comissao[];
  esperado: number;
};

const norm = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^0+/, "");

/** Mesmo número de apólice, aceitando zeros à esquerda, pontuação e prefixos/sufixos. */
export function mesmaApolice(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [curto, longo] = x.length <= y.length ? [x, y] : [y, x];
  if (curto.length < 5) return false;
  // Dígitos apenas: a seguradora às vezes inclui ramo/sucursal antes do número.
  const dx = curto.replace(/\D/g, "");
  const dy = longo.replace(/\D/g, "");
  return longo.endsWith(curto) || (dx.length >= 5 && dy.endsWith(dx));
}

const ROTULOS = {
  apolice: /ap[oó]lice|n[ºo°.]?\s*ap|proposta|documento/i,
  valor: /comiss|l[ií]quido|valor/i,
  parcela: /parc/i,
  nome: /segurado|cliente|nome|estipulante/i,
};

/** Acha a linha de cabeçalho e sugere quais colunas usar. */
export function sugerirMapa(t: Tabela): { cabecalho: number; mapa: Mapa } {
  let cabecalho = 0;
  for (let i = 0; i < Math.min(t.length, 15); i++) {
    const l = t[i] ?? [];
    const textos = l.filter((c) => c && numeroBR(c) === null).length;
    if (textos >= 2 && l.some((c) => ROTULOS.apolice.test(c))) {
      cabecalho = i;
      break;
    }
  }
  const cab = t[cabecalho] ?? [];
  const achar = (re: RegExp, evitar: number[] = []) =>
    cab.findIndex((c, i) => !evitar.includes(i) && re.test(c));
  // Prefere a coluna "comissão" à "valor" genérica (que pode ser o prêmio).
  let valor = cab.findIndex((c) => /comiss/i.test(c) && !/%|perc|taxa/i.test(c));
  const apolice = achar(ROTULOS.apolice);
  if (valor < 0) valor = achar(ROTULOS.valor, [apolice]);
  return {
    cabecalho,
    mapa: {
      apolice,
      valor,
      parcela: achar(ROTULOS.parcela, [apolice, valor]),
      nome: achar(ROTULOS.nome, [apolice, valor]),
    },
  };
}

export function conciliar(
  t: Tabela,
  cabecalho: number,
  mapa: Mapa,
  apolices: Apolice[],
  comissoes: Comissao[],
  seguradora: string,
): LinhaConciliacao[] {
  const daSeguradora = apolices.filter((a) => !seguradora || a.seguradora === seguradora);
  const porApolice = new Map<string, Comissao[]>();
  for (const c of comissoes) {
    if (c.status === "Cancelada") continue;
    const l = porApolice.get(c.apolice_id) ?? [];
    l.push(c);
    porApolice.set(c.apolice_id, l);
  }
  const usadas = new Set<string>();
  const linhas: LinhaConciliacao[] = [];
  t.slice(cabecalho + 1).forEach((l, k) => {
    const apoliceTxt = (l[mapa.apolice] ?? "").trim();
    const valor = numeroBR(l[mapa.valor]);
    const parcelaN = mapa.parcela >= 0 ? Number(/\d+/.exec(l[mapa.parcela] ?? "")?.[0]) : NaN;
    const parcela = Number.isFinite(parcelaN) && parcelaN > 0 ? parcelaN : null;
    const nome = mapa.nome >= 0 ? (l[mapa.nome] ?? "") : "";
    const base = { indice: cabecalho + 2 + k, apoliceTxt, parcela, nome, valor, esperado: 0 };
    // Linhas de total/subtotal do extrato não entram na conferência.
    if (l.some((c) => /^(sub)?total/i.test(c.trim()))) return;
    if (!apoliceTxt || valor === null || !/\d/.test(apoliceTxt)) {
      // Linhas de total/rodapé do extrato.
      if (apoliceTxt || valor !== null)
        linhas.push({ ...base, situacao: "invalida", comissoes: [] });
      return;
    }
    const candidatas = daSeguradora.filter((a) => mesmaApolice(a.numero, apoliceTxt));
    const apolice = candidatas.find((a) => norm(a.numero) === norm(apoliceTxt)) ?? candidatas[0];
    if (!apolice) {
      linhas.push({ ...base, situacao: "nao_encontrada", comissoes: [] });
      return;
    }
    const todas = (porApolice.get(apolice.id) ?? []).filter((c) => !usadas.has(c.id));
    const previstas = todas.filter((c) => c.status === "Prevista");
    // Agrupa por parcela: com rateio há uma comissão por produtor na mesma parcela.
    const grupos = new Map<string, Comissao[]>();
    for (const c of previstas) {
      const g = c.endosso_id ? `e:${c.endosso_id}` : `p:${c.parcela ?? 0}`;
      grupos.set(g, [...(grupos.get(g) ?? []), c]);
    }
    const soma = (g: Comissao[]) => g.reduce((t2, c) => t2 + Number(c.valor), 0);
    const ordenados = [...grupos.values()].sort((x, y) =>
      (x[0]?.data_prevista ?? "").localeCompare(y[0]?.data_prevista ?? ""),
    );
    let grupo: Comissao[] | undefined;
    if (parcela !== null) grupo = grupos.get(`p:${parcela}`);
    // Sem parcela no extrato: a de valor igual, senão a mais antiga em aberto.
    grupo ??=
      ordenados.find((g) => Math.abs(soma(g) - valor) <= 0.05) ??
      (parcela === null ? ordenados[0] : undefined);
    if (!grupo?.length) {
      const recebida = todas.some(
        (c) => c.status === "Recebida" && (parcela === null || c.parcela === parcela),
      );
      linhas.push({
        ...base,
        apolice,
        situacao: recebida ? "ja_recebida" : "nao_encontrada",
        comissoes: [],
      });
      return;
    }
    for (const c of grupo) usadas.add(c.id);
    const esperado = Math.round(soma(grupo) * 100) / 100;
    const tolerancia = Math.max(0.05, Math.abs(esperado) * 0.01);
    linhas.push({
      ...base,
      apolice,
      comissoes: grupo,
      esperado,
      situacao: Math.abs(esperado - valor) <= tolerancia ? "ok" : "divergente",
    });
  });
  return linhas;
}

/** Valor recebido distribuído entre as comissões da linha (proporcional ao previsto). */
export function distribuir(l: LinhaConciliacao): { comissao_id: string; valor: number }[] {
  const valor = l.valor ?? 0;
  if (l.comissoes.length === 1) {
    const c = l.comissoes[0];
    return c ? [{ comissao_id: c.id, valor }] : [];
  }
  const total = l.esperado || l.comissoes.length;
  let resto = Math.round(valor * 100);
  return l.comissoes.map((c, i) => {
    const parte =
      i === l.comissoes.length - 1
        ? resto
        : Math.round((valor * 100 * (l.esperado ? Number(c.valor) : 1)) / total);
    resto -= parte;
    return { comissao_id: c.id, valor: parte / 100 };
  });
}
